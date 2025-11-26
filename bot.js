require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Partials
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ========================= CONFIG =========================
const REG_CHANNEL = process.env.REG_CHANNEL;
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;
const APPROVER_ROLE = process.env.APPROVER_ROLE;
const REQUIRE_ROLE = process.env.REQUIRE_ROLE;

let registered = new Set();
let formStep = {};
let formData = {};


// =============================================================
// WHEN USER WRITES ANYTHING IN REG CHANNEL → SEND BUTTON
// =============================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== REG_CHANNEL) return;

  if (REQUIRE_ROLE && !msg.member.roles.cache.has(REQUIRE_ROLE)) {
    return msg.reply("❌ You don't have the required role to register!");
  }

  if (registered.has(msg.author.id)) {
    return msg.reply("❌ You already registered!");
  }

  const embed = new EmbedBuilder()
    .setTitle("📝 Tournament Registration")
    .setDescription("Click **Register Now** to start your registration in DM.")
    .setColor("Blue");

  const btn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reg-${msg.author.id}`)
      .setLabel("Register Now")
      .setStyle(ButtonStyle.Primary)
  );

  msg.reply({ embeds: [embed], components: [btn] });
});


// =============================================================
// USER CLICKS REGISTER BUTTON
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [prefix, userid] = interaction.customId.split("-");
  if (prefix !== "reg") return;

  if (interaction.user.id !== userid)
    return interaction.reply({ content: "❌ This button is not for you!", ephemeral: true });

  try {
    await interaction.reply({ content: "📩 Check your DM!", ephemeral: true });
  } catch {}

  try {
    await interaction.user.send("📝 **Welcome to Tournament Registration!**\nLet's start.");
  } catch {
    return interaction.followUp({ content: "❌ Please enable your DMs!", ephemeral: true });
  }

  formStep[userid] = 1;
  formData[userid] = {};

  interaction.user.send("**Step 1:** Enter your **Team Name**:");
});


// =============================================================
// DM FORM HANDLING
// =============================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.type !== 1) return;

  const userid = msg.author.id;
  const step = formStep[userid];
  if (!step) return;

  const text = msg.content;

  switch (step) {
    case 1:
      formData[userid].teamName = text;
      formStep[userid] = 2;
      return msg.channel.send("**Step 2:** Enter **Leader Name**:");

    case 2:
      formData[userid].leaderName = text;
      formStep[userid] = 3;
      return msg.channel.send("**Step 3:** Enter **Leader UID**:");

    case 3:
      formData[userid].leaderUID = text;
      formStep[userid] = 4;
      return msg.channel.send("**Step 4:** Enter your **Discord Username**:");

    case 4:
      formData[userid].discordName = text;
      formStep[userid] = 5;
      return msg.channel.send("**Player 1 (Name + UID):**");

    case 5:
      formData[userid].p1 = text;
      formStep[userid] = 6;
      return msg.channel.send("**Player 2 (Name + UID):**");

    case 6:
      formData[userid].p2 = text;
      formStep[userid] = 7;
      return msg.channel.send("**Player 3 (Name + UID):**");

    case 7:
      formData[userid].p3 = text;
      formStep[userid] = 8;
      return msg.channel.send("**Player 4 (Name + UID):**");

    case 8:
      formData[userid].p4 = text;

      const approveCh = await client.channels.fetch(APPROVE_CHANNEL);
      const data = formData[userid];

      const embed = new EmbedBuilder()
        .setTitle("📝 New Registration Request")
        .setColor("Blue")
        .addFields(
          { name: "User", value: `<@${userid}>` },
          { name: "Team Name", value: data.teamName },
          { name: "Leader", value: `${data.leaderName} — UID: ${data.leaderUID}` },
          { name: "Discord", value: data.discordName },
          { name: "Player 1", value: data.p1 },
          { name: "Player 2", value: data.p2 },
          { name: "Player 3", value: data.p3 },
          { name: "Player 4", value: data.p4 }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve-${userid}`).setLabel("Approve").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject-${userid}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
      );

      approveCh.send({ embeds: [embed], components: [row] });

      msg.channel.send("✅ **Registration Submitted!**");

      registered.add(userid);
      delete formStep[userid];
      delete formData[userid];
      break;
  }
});


// =============================================================
// APPROVE & REJECT
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channel.id !== APPROVE_CHANNEL) return;

  if (!interaction.member.roles.cache.has(APPROVER_ROLE))
    return interaction.reply({ content: "❌ You are not allowed to approve.", ephemeral: true });

  const [action, userid] = interaction.customId.split("-");
  const user = await interaction.guild.members.fetch(userid).catch(() => null);

  if (!user) return interaction.reply("❌ User not found.");

  if (action === "approve") {
    interaction.reply(`✅ Approved by <@${interaction.user.id}>`);
    user.send("🎉 Your registration is **approved!**");
  }

  if (action === "reject") {
    interaction.reply({ content: "Send reject reason:", ephemeral: true });

    const filter = (m) => m.author.id === interaction.user.id;
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });

    const reason = collected.first()?.content || "No reason given";

    collected.first()?.delete().catch(() => {});

    user.send(`❌ Your registration was rejected.\n**Reason:** ${reason}`);
    interaction.followUp({ content: `❌ Rejected (${reason})`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
