require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ENV
const APPROVER_ROLE = process.env.APPROVER_ROLE;
const REG_CHANNEL = process.env.REG_CHANNEL;
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;
const REQUIRED_ROLE = process.env.REQUIRED_ROLE || "none";

let registered = new Set();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Slash command register
client.on("ready", async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.commands.set([
    {
      name: "setpanel",
      description: "Setup tournament registration panel"
    }
  ]);

  console.log("Slash command registered.");
});

// /setpanel
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== APPROVER_ROLE) {
    return interaction.reply({
      content: "❌ You are not allowed to use this command.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "setpanel") {
    const embed = new EmbedBuilder()
      .setTitle("📌 Free Fire Tournament Registration")
      .setDescription("রেজিস্ট্রেশন করতে নিচের বাটনে ক্লিক করুন।")
      .setColor("Yellow");

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_form")
        .setLabel("📋 Register Here")
        .setStyle(ButtonStyle.Primary)
    );

    const ch = interaction.guild.channels.cache.get(REG_CHANNEL);
    if (!ch) return interaction.reply({ content: "Registration channel missing!", ephemeral: true });

    await ch.send({ embeds: [embed], components: [btn] });
    interaction.reply({ content: "Panel created.", ephemeral: true });
  }
});

// OPEN FORM
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_form") {

    if (REQUIRED_ROLE !== "none") {
      if (!interaction.member.roles.cache.has(REQUIRED_ROLE)) {
        return interaction.reply({
          content: "❌ You do not have the required role to register.",
          ephemeral: true
        });
      }
    }

    if (registered.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You already registered!",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("reg_form_full")
      .setTitle("FULL TEAM REGISTRATION");

    // ======== Leader ========
    const leaderName = new TextInputBuilder()
      .setCustomId("leaderName")
      .setLabel("Leader Game Name")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const leaderUID = new TextInputBuilder()
      .setCustomId("leaderUID")
      .setLabel("Leader UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const discordID = new TextInputBuilder()
      .setCustomId("discordID")
      .setLabel("Leader Discord User ID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const phone = new TextInputBuilder()
      .setCustomId("phone")
      .setLabel("Phone Number")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // ======== Player 2 ========
    const p2 = new TextInputBuilder()
      .setCustomId("p2")
      .setLabel("Player 2 Name - UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // ======== Player 3 ========
    const p3 = new TextInputBuilder()
      .setCustomId("p3")
      .setLabel("Player 3 Name - UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // ======== Player 4 ========
    const p4 = new TextInputBuilder()
      .setCustomId("p4")
      .setLabel("Player 4 Name - UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // ======== Player 5 ========
    const p5 = new TextInputBuilder()
      .setCustomId("p5")
      .setLabel("Player 5 Name - UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(leaderName),
      new ActionRowBuilder().addComponents(leaderUID),
      new ActionRowBuilder().addComponents(discordID),
      new ActionRowBuilder().addComponents(phone),
      new ActionRowBuilder().addComponents(p2),
      new ActionRowBuilder().addComponents(p3),
      new ActionRowBuilder().addComponents(p4),
      new ActionRowBuilder().addComponents(p5)
    );

    return interaction.showModal(modal);
  }
});

// FORM SUBMIT (ALL PLAYERS)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "reg_form_full") {
    registered.add(interaction.user.id);

    const leaderName = interaction.fields.getTextInputValue("leaderName");
    const leaderUID = interaction.fields.getTextInputValue("leaderUID");
    const discordID = interaction.fields.getTextInputValue("discordID");
    const phone = interaction.fields.getTextInputValue("phone");

    const p2 = interaction.fields.getTextInputValue("p2");
    const p3 = interaction.fields.getTextInputValue("p3");
    const p4 = interaction.fields.getTextInputValue("p4");
    const p5 = interaction.fields.getTextInputValue("p5");

    // ASK FOR SCREENSHOTS
    await interaction.reply({
      content: "📸 Please upload **5 screenshots in one message**.",
      ephemeral: true
    });

    const filter = (m) => m.author.id === interaction.user.id && m.attachments.size >= 1;

    const ssMsg = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 120000
    });

    const msg = ssMsg.first();
    if (!msg) {
      return interaction.followUp({
        content: "❌ Time expired! Please start again.",
        ephemeral: true
      });
    }

    const ss = msg.attachments.map((a) => a.url);

    const approveCh = interaction.guild.channels.cache.get(APPROVE_CHANNEL);

    const embed = new EmbedBuilder()
      .setTitle("📝 New Team Registration")
      .addFields(
        { name: "Leader Name", value: leaderName },
        { name: "Leader UID", value: leaderUID },
        { name: "Discord ID", value: discordID },
        { name: "Phone", value: phone },
        { name: "Player 2", value: p2 },
        { name: "Player 3", value: p3 },
        { name: "Player 4", value: p4 },
        { name: "Player 5", value: p5 }
      )
      .setColor("Blue")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${interaction.user.id}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_${interaction.user.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
    );

    approveCh.send({
      embeds: [embed],
      components: [row],
      files: ss
    });

    interaction.followUp({
      content: "🎉 Final submission complete!",
      ephemeral: true
    });
  }
});

// APPROVE / DENY
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split("_");
  if (!["approve", "deny"].includes(action)) return;

  const user = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!user) {
    return interaction.reply({ content: "User not found.", ephemeral: true });
  }

  if (action === "approve") {
    user.send("🎉 Your registration is **APPROVED**!");
    return interaction.reply({ content: "Approved!", ephemeral: true });
  }

  if (action === "deny") {
    user.send("❌ Your registration is **REJECTED**.");
    return interaction.reply({ content: "Rejected!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
