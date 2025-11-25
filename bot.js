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
const REQUIRED_ROLE = process.env.REQUIRED_ROLE || "none"; // optional role requirement

let registered = new Set();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Slash Command create
client.on("ready", async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  await guild.commands.set([
    {
      name: "setpanel",
      description: "Setup tournament registration panel"
    }
  ]);

  console.log("Slash command ready.");
});

// Only approver can use /setpanel
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== APPROVER_ROLE)
    return interaction.reply({ content: "❌ You are not allowed!", ephemeral: true });

  if (interaction.commandName === "setpanel") {
    const embed = new EmbedBuilder()
      .setTitle("📌 Free Fire Tournament Registration")
      .setDescription("রেজিস্টার করতে নিচের বাটনে ক্লিক করুন।")
      .setColor("Yellow");

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_form")
        .setLabel("📋 Register Now")
        .setStyle(ButtonStyle.Primary)
    );

    const ch = interaction.guild.channels.cache.get(REG_CHANNEL);
    if (!ch) return interaction.reply({ content: "Channel missing!", ephemeral: true });

    await ch.send({ embeds: [embed], components: [btn] });
    interaction.reply({ content: "Panel posted!", ephemeral: true });
  }
});

// BUTTON → OPEN FORM
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_form") {

    // Required role check
    if (REQUIRED_ROLE !== "none") {
      if (!interaction.member.roles.cache.has(REQUIRED_ROLE)) {
        return interaction.reply({
          content: "❌ You do not have permission to register.",
          ephemeral: true
        });
      }
    }

    if (registered.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You already submitted registration!",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("reg_form")
      .setTitle("Tournament Registration Form");

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

    modal.addComponents(
      new ActionRowBuilder().addComponents(leaderName),
      new ActionRowBuilder().addComponents(leaderUID),
      new ActionRowBuilder().addComponents(discordID),
      new ActionRowBuilder().addComponents(phone)
    );

    return interaction.showModal(modal);
  }
});

// AFTER MODAL → ASK PLAYER & SCREENSHOTS
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "reg_form") {
    const leaderName = interaction.fields.getTextInputValue("leaderName");
    const leaderUID = interaction.fields.getTextInputValue("leaderUID");
    const discordID = interaction.fields.getTextInputValue("discordID");
    const phone = interaction.fields.getTextInputValue("phone");

    registered.add(interaction.user.id);

    // Ask For Player Details + Screenshots
    await interaction.reply({
      content:
        "✅ Form Step 1 submitted!\nNow send **Player 2–5 Name & UID + 5 Screenshots** here.\n\n**Format:**\n```\nPlayer 2 Name - UID\nPlayer 3 Name - UID\nPlayer 4 Name - UID\nPlayer 5 Name - UID\n```\n📸 Upload 5 screenshots in the SAME message.",
      ephemeral: true
    });

    const filter = (m) => m.author.id === interaction.user.id && m.attachments.size >= 1;

    const msg = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 120000
    });

    const userMsg = msg.first();
    if (!userMsg)
      return interaction.followUp({
        content: "❌ Time expired! Start again.",
        ephemeral: true
      });

    const screenshots = userMsg.attachments.map((a) => a.url);

    const reviewChannel = interaction.guild.channels.cache.get(APPROVE_CHANNEL);

    const embed = new EmbedBuilder()
      .setTitle("📝 New Team Registration")
      .addFields(
        { name: "Leader Name", value: leaderName },
        { name: "Leader UID", value: leaderUID },
        { name: "Discord User ID", value: discordID },
        { name: "Phone", value: phone },
        { name: "Players", value: userMsg.content || "Not provided" }
      )
      .setColor("Blue")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny_${interaction.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
    );

    await reviewChannel.send({
      embeds: [embed],
      components: [row],
      files: screenshots
    });

    interaction.followUp({
      content: "🎉 Final Submission Done!",
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

  if (!user)
    return interaction.reply({ content: "User not found!", ephemeral: true });

  if (action === "approve") {
    user.send("🎉 Your registration is **APPROVED**!");
    interaction.reply({ content: "User approved!", ephemeral: true });
  } else {
    user.send("❌ Your registration is **REJECTED**.");
    interaction.reply({ content: "User rejected!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
