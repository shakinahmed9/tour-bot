// bot.js
require("dotenv").config();
const fs = require("fs-extra");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const REG_CHANNEL = process.env.REG_CHANNEL; // where users type start message or click button
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL; // where approvers will see requests
const APPROVER_ROLE = process.env.APPROVER_ROLE; // role id allowed to approve
const REQUIRE_ROLE = process.env.REQUIRE_ROLE || null; // optional role id required to register
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "registrations.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// load persisted registrations (approved/rejected/stored)
async function loadData() {
  try {
    const exists = await fs.pathExists(DATA_FILE);
    if (!exists) {
      await fs.writeJson(DATA_FILE, { requests: {}, approved: {}, rejected: {} }, { spaces: 2 });
    }
    return await fs.readJson(DATA_FILE);
  } catch (err) {
    console.error("Failed to load data:", err);
    return { requests: {}, approved: {}, rejected: {} };
  }
}

async function saveData(data) {
  await fs.writeJson(DATA_FILE, data, { spaces: 2 });
}

// in-memory quick objects
let dataStore = await loadData();

// ---- Configuration: change questions here ----
// Each item is an object { id, question, placeholder, type }
// type can be: "text" or "select" (select must include options array)
const FORM_QUESTIONS = [
  { id: "teamName", question: "Step 1: Team Name", placeholder: "Enter your team name", type: "text" },
  { id: "leaderName", question: "Step 2: Leader Name", placeholder: "Leader full name", type: "text" },
  { id: "leaderUID", question: "Step 3: Leader UID", placeholder: "Leader in-game UID", type: "text" },
  { id: "discordName", question: "Step 4: Discord Username", placeholder: "e.g. Username#1234", type: "text" },
  { id: "p1", question: "Player 1 (Name + UID)", placeholder: "Name - UID", type: "text" },
  { id: "p2", question: "Player 2 (Name + UID)", placeholder: "Name - UID", type: "text" },
  { id: "p3", question: "Player 3 (Name + UID)", placeholder: "Name - UID", type: "text" },
  { id: "p4", question: "Player 4 (Name + UID)", placeholder: "Name - UID", type: "text" },
  // Example of a select question:
  // { id: "rulesAgree", question: "Do you accept the tournament rules?", type: "select", options: [{label:'Yes', value:'yes'}, {label:'No', value:'no'}] }
];

// ---- Utility: create a "Register Now" button if someone uses the registration channel ----
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;

    // If message in registration channel, send an embed+button prompting DM flow
    if (msg.channel.id === REG_CHANNEL) {
      // require role check if set
      if (REQUIRE_ROLE) {
        const member = msg.member;
        if (!member || !member.roles.cache.has(REQUIRE_ROLE)) {
          return msg.reply({ content: "❌ You don't have the required role to start registration.", ephemeral: true });
        }
      }

      // Already registered? check persistent store (requests/approved) by user id
      const exists = dataStore.requests[msg.author.id] || dataStore.approved[msg.author.id];
      if (exists) {
        return msg.reply("❌ You already submitted a registration or it's approved.");
      }

      const embed = new EmbedBuilder()
        .setTitle("📝 Tournament Registration")
        .setDescription("Click **Register Now** to start the registration process in your DM.")
        .setColor("Blurple");

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`reg_${msg.author.id}`).setLabel("Register Now").setStyle(ButtonStyle.Primary)
      );

      return msg.reply({ embeds: [embed], components: [btnRow] });
    }

    // If user types "status" in DMs, show their last request status
    if (msg.channel.type === ChannelType.DM && msg.content.toLowerCase() === "status") {
      const userId = msg.author.id;
      if (dataStore.approved[userId]) return msg.channel.send("✅ Your registration was approved.");
      if (dataStore.rejected[userId]) return msg.channel.send(`❌ Rejected: ${dataStore.rejected[userId].reason || "No reason given"}`);
      if (dataStore.requests[userId]) return msg.channel.send("ℹ️ Your registration is pending review.");
      return msg.channel.send("No registration found. Start in the registration channel.");
    }
  } catch (err) {
    console.error("messageCreate handler error:", err);
  }
});

// ---- Single interactionCreate for buttons & selects ----
client.on("interactionCreate", async (interaction) => {
  try {
    // BUTTON: register start button
    if (interaction.isButton()) {
      const [action, userId] = interaction.customId.split("_");
      if (action === "reg") {
        if (interaction.user.id !== userId) {
          return interaction.reply({ content: "❌ This button is not for you.", ephemeral: true });
        }

        // ephemeral ack
        await interaction.reply({ content: "📩 Check your DMs — starting registration.", ephemeral: true });

        // Start DM flow
        try {
          const dm = await interaction.user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("📝 Tournament Registration — DM Form")
                .setDescription("I will walk you through a few questions. Send `cancel` at any time to stop.")
                .setColor("Green"),
            ],
          });

          // start the DM collector-driven form
          startUserForm(interaction.user);
        } catch (err) {
          // couldn't DM the user
          return interaction.followUp({ content: "❌ I can't DM you. Please enable DMs from server members.", ephemeral: true });
        }
      }
    }

    // BUTTON: Approve / Reject (from approval channel)
    if (interaction.isButton()) {
      // safety: require correct channel
      if (interaction.channelId !== APPROVE_CHANNEL) {
        // other buttons (if any) can be ignored
        return;
      }

      if (!interaction.member.roles.cache.has(APPROVER_ROLE)) {
        return interaction.reply({ content: "❌ You are not allowed to approve/reject.", ephemeral: true });
      }

      // pattern: approve-<userid>-<requestId>
      const [act, userId] = interaction.customId.split("-");
      if (!userId) return interaction.reply({ content: "Invalid action.", ephemeral: true });

      const storedRequest = dataStore.requests[userId];
      if (!storedRequest) {
        // maybe already processed
        await interaction.reply({ content: "ℹ️ This request was already processed or not found.", ephemeral: true });
        return;
      }

      const message = interaction.message;

      if (act === "approve") {
        // mark approved
        dataStore.approved[userId] = {
          ...storedRequest,
          approver: interaction.user.id,
          approvedAt: new Date().toISOString(),
        };
        delete dataStore.requests[userId];
        await saveData(dataStore);

        // Disable buttons
        try {
          const disabledRow = disableAllButtons(message.components);
          await message.edit({ components: [disabledRow] });
        } catch (err) {}

        await interaction.reply({ content: `✅ Approved by <@${interaction.user.id}>`, ephemeral: false });
        try {
          const user = await client.users.fetch(userId);
          await user.send(`🎉 Your registration for **${storedRequest.data.teamName || "the tournament"}** has been **approved**!`);
        } catch (err) {}

      } else if (act === "reject") {
        // ask for reason (ephemeral follow up)
        await interaction.reply({ content: "✉️ Please send a rejection reason in this channel (you have 60s).", ephemeral: true });

        const filter = (m) => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

        collector.on("collect", async (m) => {
          const reason = m.content || "No reason provided";
          dataStore.rejected[userId] = {
            ...storedRequest,
            rejector: interaction.user.id,
            rejectedAt: new Date().toISOString(),
            reason,
          };
          delete dataStore.requests[userId];
          await saveData(dataStore);

          // Disable buttons on message
          try {
            const disabledRow = disableAllButtons(message.components);
            await message.edit({ components: [disabledRow] });
          } catch (err) {}

          await interaction.followUp({ content: `❌ Rejected with reason: ${reason}`, ephemeral: true });

          try {
            const user = await client.users.fetch(userId);
            await user.send(`❌ Your registration has been rejected.\n**Reason:** ${reason}`);
          } catch (err) {}
          // remove the admin's reason message for cleanliness (optional)
          try { m.delete().catch(() => {}); } catch (e) {}
        });

        collector.on("end", (collected) => {
          if (collected.size === 0) {
            interaction.followUp({ content: "No reason provided. Rejection cancelled.", ephemeral: true });
          }
        });
      }
    }
  } catch (err) {
    console.error("interactionCreate error:", err);
  }
});

// ---- Helper: disable all buttons in a message's components and return a new ActionRow ----
function disableAllButtons(components) {
  // assume first row only for simplicity; adapt if there are multiple rows
  const row = components[0];
  const newRow = new ActionRowBuilder();
  for (const comp of row.components) {
    if (comp.type === 2) {
      newRow.addComponents(
        ButtonBuilder.from(comp).setDisabled(true)
      );
    } else {
      // keep others as-is (rare)
      newRow.addComponents(comp);
    }
  }
  return newRow;
}

// ---- Start DM form using collectors / sequential prompts ----
async function startUserForm(user) {
  // prevent concurrent forms for same user
  if (dataStore.requests[user.id]) {
    try { await user.send("ℹ️ You already have a pending request. Wait for approval or use `status`."); } catch (e) {}
    return;
  }

  const formData = {};
  try {
    const dm = await user.send({ embeds: [new EmbedBuilder().setTitle("Registration").setDescription("Let's begin. Type `cancel` anytime to abort.").setColor("Green")] });

    // function to ask a question and wait for reply
    const ask = async (q) => {
      if (q.type === "text") {
        await user.send({ embeds: [new EmbedBuilder().setDescription(`**${q.question}**\n${q.placeholder ? `\n*${q.placeholder}*` : ""}`)] });
        const filter = (m) => m.author.id === user.id;
        const collected = await user.dmChannel.awaitMessages({ filter, max: 1, time: 180000 }).catch(() => null);
        if (!collected || collected.size === 0) throw new Error("timeout");
        const msg = collected.first();
        if (!msg) throw new Error("no message");
        if (msg.content.toLowerCase() === "cancel") throw new Error("cancelled");
        return msg.content;
      } else if (q.type === "select") {
        // build select menu
        const options = q.options || [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }];
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`select_${user.id}_${q.id}`)
          .setPlaceholder(q.question)
          .addOptions(options.map(o => ({ label: o.label, value: o.value })))
          .setMinValues(1)
          .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(menu);
        const sent = await user.send({ content: q.question, components: [row] });

        // collector for component interaction
        const filter = (i) => i.user.id === user.id && i.customId.startsWith(`select_${user.id}_`);
        const collected = await sent.awaitMessageComponent({ filter, time: 120000 }).catch(() => null);
        if (!collected) throw new Error("timeout");
        const value = collected.values[0];
        await collected.update({ content: `You selected: **${value}**`, components: [] });
        return value;
      }
    };

    for (const q of FORM_QUESTIONS) {
      // short delay to avoid rate issues
      await new Promise((r) => setTimeout(r, 250));
      const answer = await ask(q);
      formData[q.id] = answer;
    }

    // After finishing, create approval embed and send to approve channel
    const approveCh = await client.channels.fetch(APPROVE_CHANNEL).catch(() => null);
    if (!approveCh) {
      await user.send("⚠️ Unable to submit registration: approval channel not found. Contact admins.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📝 New Registration Request")
      .setColor("Aqua")
      .setDescription(`Registration request from <@${user.id}>`)
      .addFields(
        { name: "User", value: `<@${user.id}>`, inline: true },
        { name: "User ID", value: `${user.id}`, inline: true },
        { name: "Status", value: "Pending", inline: true }
      )
      .setTimestamp();

    // add each answered field
    for (const q of FORM_QUESTIONS) {
      const val = formData[q.id] || "—";
      embed.addFields({ name: q.question, value: String(val).slice(0, 1000), inline: false });
    }

    // Buttons: approve-<userid> and reject-<userid>
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve-${user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject-${user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
    );

    const sent = await approveCh.send({ embeds: [embed], components: [row] });

    // store the request in persistent store
    dataStore.requests[user.id] = {
      userId: user.id,
      data: formData,
      submittedAt: new Date().toISOString(),
      approvalMessageId: sent.id,
      approvalChannelId: approveCh.id,
    };
    await saveData(dataStore);

    await user.send("✅ Your registration was submitted. Await approval in the server. Use `status` in DM to check.");
  } catch (err) {
    // handle user cancelled or timeout
    if (err && err.message === "cancelled") {
      try { await user.send("❌ Registration cancelled."); } catch (e) {}
      return;
    }
    if (err && err.message === "timeout") {
      try { await user.send("⌛ Time out: you took too long to answer. Please start again in the registration channel."); } catch (e) {}
      return;
    }
    console.error("startUserForm error:", err);
    try { await user.send("❌ Something went wrong with your registration. Try again later."); } catch (e) {}
  }
}

// ---- Boot ----
client.once("ready", () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.login(TOKEN).catch((err) => {
  console.error("Failed to login:", err);
});
