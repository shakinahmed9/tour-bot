require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ===============================
// CONFIG VARIABLES
// ===============================
const OWNER_ID = process.env.OWNER_ID;              // Only bot owner can run commands
const REG_CHANNEL_ID = process.env.REG_CHANNEL_ID;  // Registration form channel
const REVIEW_CHANNEL_ID = process.env.REVIEW_CHANNEL_ID; // Staff review channel

// ===============================
// READY EVENT
// ===============================
client.once("ready", () => {
  console.log(`Bot Logged in as ${client.user.tag}`);
});

// ===============================
// OWNER-ONLY COMMANDS
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.user.id !== OWNER_ID) {
    return interaction.reply({ content: "❌ You are not allowed to use this command.", ephemeral: true });
  }

  if (interaction.commandName === "setpanel") {
    const panelEmbed = new EmbedBuilder()
      .setTitle("📌 Free Fire Tournament Registration")
      .setDescription("নিচের বাটনে ক্লিক করে রেজিস্ট্রেশন ফরম পূরণ করুন।")
      .setColor("Yellow")
      .setThumbnail(interaction.guild.iconURL());

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

// ===============================
// BUTTON: OPEN FORM
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "open_form") {
    const modal = {
      title: "FF Tournament Registration",
      custom_id: "reg_form",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "name",
              label: "Player Name",
              style: 1,
              min_length: 2,
              max_length: 50,
              required: true,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "uid",
              label: "Free Fire UID",
              style: 1,
              min_length: 5,
              max_length: 20,
              required: true,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "phone",
              label: "Phone Number",
              style: 1,
              min_length: 10,
              max_length: 15,
              required: true,
            },
          ],
        },
      ],
    };

    interaction.showModal(modal);
  }
});

// ===============================
// FORM SUBMIT
// ===============================
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
      .setTitle("📝 New Tournament Registration")
      .addFields(
        { name: "👤 Name", value: name },
        { name: "🆔 UID", value: uid },
        { name: "📱 Phone", value: phone },
        { name: "🕒 Time", value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
      )
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_${interaction.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
    );

    await reviewChannel.send({ embeds: [reviewEmbed], components: [row] });

    interaction.reply({
      content: "✅ Your registration has been submitted!",
      ephemeral: true,
    });
  }
});

// ===============================
// ACCEPT / REJECT SYSTEM
// ===============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split("_");

  if (!["accept", "reject"].includes(action)) return;

  const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!targetUser)
    return interaction.reply({ content: "User no longer exists.", ephemeral: true });

  if (action === "accept") {
    targetUser.send("🎉 Your registration has been **ACCEPTED**!").catch(() => {});
    interaction.reply({ content: "User accepted!", ephemeral: true });
  } else {
    targetUser.send("❌ Your registration has been **REJECTED**.").catch(() => {});
    interaction.reply({ content: "User rejected!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
