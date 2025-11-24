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
  ],
  partials: [Partials.Channel],
});

// ========================================
// CONFIG
// ========================================
const OWNER_ID = process.env.OWNER_ID;
const REG_CHANNEL_ID = process.env.REG_CHANNEL_ID;
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID;

// ========================================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ========================================
// COMMAND: /setpanel (OWNER ONLY)
// ========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: "❌ You are not allowed to use this command.", ephemeral: true });
  }

  if (interaction.commandName === "setpanel") {
    const panelEmbed = new EmbedBuilder()
      .setTitle("📌 Free Fire Tournament Registration")
      .setDescription("নিচের বাটনে ক্লিক করে রেজিস্ট্রেশন করুন।")
      .setColor("Yellow");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_form")
        .setLabel("📋 Register Now")
        .setStyle(ButtonStyle.Primary)
    );

    const regChannel = interaction.guild.channels.cache.get(REG_CHANNEL_ID);

    if (!regChannel)
      return interaction.reply({ content: "Registration channel not found!", ephemeral: true });

    await regChannel.send({ embeds: [panelEmbed], components: [row] });

    interaction.reply({ content: "Registration panel posted!", ephemeral: true });
  }
});

// ========================================
// BUTTON — OPEN FORM
// ========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_form") {
    const modal = new ModalBuilder()
      .setCustomId("reg_form")
      .setTitle("FF Tournament Registration");

    const name = new TextInputBuilder()
      .setCustomId("name")
      .setLabel("Player Name")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const uid = new TextInputBuilder()
      .setCustomId("uid")
      .setLabel("Free Fire UID")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    const phone = new TextInputBuilder()
      .setCustomId("phone")
      .setLabel("Phone Number")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    modal.addComponents(
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(uid),
      new ActionRowBuilder().addComponents(phone)
    );

    return interaction.showModal(modal);
  }
});

// ========================================
// FORM SUBMIT
// ========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "reg_form") {
    const name = interaction.fields.getTextInputValue("name");
    const uid = interaction.fields.getTextInputValue("uid");
    const phone = interaction.fields.getTextInputValue("phone");

    const reviewChannel = interaction.guild.channels.cache.get(REVIEW_CHANNEL_ID);

    if (!reviewChannel)
      return interaction.reply({
        content: "Review channel missing!",
        ephemeral: true,
      });

    const reviewEmbed = new EmbedBuilder()
      .setTitle("📝 New Registration")
      .addFields(
        { name: "👤 Name", value: name },
        { name: "🆔 UID", value: uid },
        { name: "📱 Phone", value: phone },
      )
      .setColor("Blue")
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny_${interaction.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
    );

    await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });

    interaction.reply({
      content: "✅ Your registration is submitted!",
      ephemeral: true,
    });
  }
});

// ========================================
// ACCEPT / REJECT
// ========================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split("_");

  if (!["approve", "deny"].includes(action)) return;

  const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!targetUser)
    return interaction.reply({ content: "User not found.", ephemeral: true });

  if (action === "approve") {
    targetUser.send("🎉 Your registration has been **ACCEPTED**!").catch(() => {});
    return interaction.reply({ content: "User accepted!", ephemeral: true });
  } else {
    targetUser.send("❌ Your registration has been **REJECTED**.").catch(() => {});
    return interaction.reply({ content: "User rejected!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
