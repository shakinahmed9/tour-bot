require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ENV CONFIG
const REG_CHANNEL = process.env.REG_CHANNEL;            // User registration channel
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;    // Staff approval channel
const APPROVER_ROLE = process.env.APPROVER_ROLE;        // Staff approve role

let registered = new Set(); // একবার রেজিস্টার সেভ থাকবে

// ==============================================
// USER REGISTRATION (ONLY REG_CHANNEL)
// ==============================================
client.on("messageCreate", async (msg) => {

  // DM blocked
  if (msg.channel.type === 1) return;

  // User must send in REG_CHANNEL
  if (msg.channel.id !== REG_CHANNEL) return;

  // Already registered?
  if (registered.has(msg.author.id)) {
    return msg.reply("❌ You are already registered.");
  }

  // Registration embed
  const embed = new EmbedBuilder()
    .setTitle("New Registration Request")
    .addFields(
      { name: "User", value: `<@${msg.author.id}>` },
      { name: "Message", value: msg.content }
    )
    .setColor("Blue")
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${msg.author.id}`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_${msg.author.id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger)
  );

  // Send to approval channel
  const approveChannel = msg.guild.channels.cache.get(APPROVE_CHANNEL);
  if (!approveChannel)
    return msg.reply("⚠ Approve channel not found in config!");

  approveChannel.send({
    embeds: [embed],
    components: [row],
  });

  msg.reply("✅ Your registration has been submitted for review!");
  registered.add(msg.author.id);
});

// ==============================================
// APPROVE / REJECT SYSTEM
// ==============================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Approve must only happen in APPROVE_CHANNEL
  if (interaction.channel.id !== APPROVE_CHANNEL) {
    return interaction.reply({
      content: "❌ You cannot approve/reject here.",
      ephemeral: true,
    });
  }

  // Must have staff role
  if (!interaction.member.roles.cache.has(APPROVER_ROLE)) {
    return interaction.reply({
      content: "❌ You don't have permission for this.",
      ephemeral: true,
    });
  }

  const [type, userid] = interaction.customId.split("_");

  const user = await interaction.guild.members.fetch(userid).catch(() => null);
  if (!user)
    return interaction.reply("User no longer exists.");

  // ========== APPROVE ==========
  if (type === "approve") {
    interaction.reply(`✅ Approved by <@${interaction.user.id}>`);

    user.send("🎉 **Congratulations! Your registration has been APPROVED!**")
      .catch(() => {});
  }

  // ========== REJECT ==========
  if (type === "reject") {
    interaction.reply({
      content: "❌ Please type reject reason:",
      ephemeral: true
    });

    const filter = (m) => m.author.id === interaction.user.id;

    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 30000
    });

    const reason = collected.first()?.content || "No reason provided";

    // Clean message
    if (collected.first()) collected.first().delete().catch(() => {});

    user.send(`❌ Your registration was **REJECTED**.\n**Reason:** ${reason}`)
      .catch(() => {});

    interaction.followUp({
      content: `❌ Rejected.\nReason: **${reason}**`,
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
