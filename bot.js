require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Partials,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ========================= ENV CONFIG =========================
const REG_CHANNEL = process.env.REG_CHANNEL; 
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;
const APPROVER_ROLE = process.env.APPROVER_ROLE;
const REQUIRE_ROLE = process.env.REQUIRE_ROLE; // <<=== REQUIRED ROLE HERE

let tempData = {};
let registered = new Set();

// =============================================================
// SEND REGISTRATION BUTTON WHEN USER WRITES IN REG CHANNEL
// =============================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== REG_CHANNEL) return;

  // Required Role Check
  if (REQUIRE_ROLE && !msg.member.roles.cache.has(REQUIRE_ROLE)) {
    return msg.reply("❌ You don't have the required role to register.");
  }

  if (registered.has(msg.author.id)) {
    return msg.reply("❌ You already registered.");
  }

  const embed = new EmbedBuilder()
    .setTitle("📝 Tournament Registration")
    .setDescription("Click **Register Now** to start registration in DM.")
    .setColor("Blue");

  const btn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_${msg.author.id}`)
      .setLabel("Register Now")
      .setStyle(ButtonStyle.Primary)
  );

  msg.reply({ embeds: [embed], components: [btn] });
});

// =============================================================
// OPEN STEP 1 — TEAM + LEADER FORM IN DM
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [type, userid] = interaction.customId.split("_");
  if (type !== "start") return;

  if (interaction.user.id !== userid)
    return interaction.reply({ content: "❌ This button is not for you.", ephemeral: true });

  try {
    await interaction.reply({ content: "📩 Check your DM!", ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`step1_${userid}`)
      .setTitle("Team Registration — Step 1");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("teamName")
          .setLabel("Team Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("leaderName")
          .setLabel("Leader Name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("leaderUID")
          .setLabel("Leader UID")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("discordName")
          .setLabel("Discord Username")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.user.send("📝 **Fill Step 1 Form**");
    await interaction.user.showModal(modal);

  } catch (err) {
    return interaction.reply({
      content: "❌ I cannot DM you. Turn on your DM.",
      ephemeral: true
    });
  }
});

// =============================================================
// STEP 1 SUBMISSION → OPEN STEP 2
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const [form, userid] = interaction.customId.split("_");

  if (form !== "step1") return;
  if (interaction.user.id !== userid)
    return interaction.reply({ content: "❌ Not your form.", ephemeral: true });

  tempData[userid] = {
    teamName: interaction.fields.getTextInputValue("teamName"),
    leaderName: interaction.fields.getTextInputValue("leaderName"),
    leaderUID: interaction.fields.getTextInputValue("leaderUID"),
    discordName: interaction.fields.getTextInputValue("discordName")
  };

  // Step 2 modal
  const modal2 = new ModalBuilder()
    .setCustomId(`step2_${userid}`)
    .setTitle("Player Registration — Step 2");

  modal2.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("p1").setLabel("Player 1 (Name + UID)").setStyle(1).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("p2").setLabel("Player 2 (Name + UID)").setStyle(1).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("p3").setLabel("Player 3 (Name + UID)").setStyle(1).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("p4").setLabel("Player 4 (Name + UID)").setStyle(1).setRequired(true)
    )
  );

  await interaction.reply({ content: "Step 1 complete! Opening next form…" });
  await interaction.user.showModal(modal2);
});

// =============================================================
// STEP 2 → FINAL SUBMIT
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const [form, userid] = interaction.customId.split("_");
  if (form !== "step2") return;

  let data = tempData[userid];
  if (!data) return interaction.reply("❌ Something went wrong.");

  // Save step 2 data
  data.p1 = interaction.fields.getTextInputValue("p1");
  data.p2 = interaction.fields.getTextInputValue("p2");
  data.p3 = interaction.fields.getTextInputValue("p3");
  data.p4 = interaction.fields.getTextInputValue("p4");

  delete tempData[userid];

  // Send to approve channel
  const approveCh = await client.channels.fetch(APPROVE_CHANNEL);

  const embed = new EmbedBuilder()
    .setTitle("📝 New Registration Request")
    .setColor("Blue")
    .addFields(
      { name: "User", value: `<@${userid}>` },
      { name: "Team Name", value: data.teamName },
      { name: "Leader", value: `${data.leaderName} — UID: ${data.leaderUID}` },
      { name: "Discord Username", value: data.discordName },
      { name: "Player 1", value: data.p1 },
      { name: "Player 2", value: data.p2 },
      { name: "Player 3", value: data.p3 },
      { name: "Player 4", value: data.p4 }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${userid}`).setLabel("Approve").setStyle(3),
    new ButtonBuilder().setCustomId(`reject_${userid}`).setLabel("Reject").setStyle(4)
  );

  approveCh.send({ embeds: [embed], components: [row] });

  interaction.reply("✅ Registration Submitted! Please wait for approval.");
  registered.add(userid);
});

// =============================================================
// APPROVE / REJECT
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channel.id !== APPROVE_CHANNEL) return;

  if (!interaction.member.roles.cache.has(APPROVER_ROLE))
    return interaction.reply({ content: "❌ You cannot approve.", ephemeral: true });

  const [action, userid] = interaction.customId.split("_");
  const user = await interaction.guild.members.fetch(userid).catch(() => null);

  if (!user) return interaction.reply("❌ User not found.");

  if (action === "approve") {
    interaction.reply(`✅ Approved by <@${interaction.user.id}>`);
    user.send("🎉 Your registration has been **approved!**");
  }

  if (action === "reject") {
    interaction.reply({ content: "❌ Type reject reason:", ephemeral: true });

    const filter = (m) => m.author.id === interaction.user.id;
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
    const reason = collected.first()?.content || "No reason";

    collected.first()?.delete().catch(() => {});
    user.send(`❌ Your registration was **rejected**.\n**Reason:** ${reason}`);

    interaction.followUp({ content: `❌ Rejected: ${reason}`, ephemeral: true });
  }
});

// =============================================================
client.login(process.env.TOKEN);
