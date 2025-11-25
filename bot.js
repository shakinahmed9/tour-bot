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
const REG_CHANNEL = process.env.REG_CHANNEL;        // Channel where users type to get Register button
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL; 
const APPROVER_ROLE = process.env.APPROVER_ROLE;    
const REQUIRE_ROLE = process.env.REQUIRE_ROLE;      

let registered = new Set();
let formStep = {};       // Tracks DM steps
let formData = {};       // Stores answers

// =============================================================
// WHEN USER WRITES ANYTHING IN REG CHANNEL → SEND BUTTON
// =============================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== REG_CHANNEL) return;

  // Require role check
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
      .setCustomId(`regstart_${msg.author.id}`)
      .setLabel("Register Now")
      .setStyle(ButtonStyle.Primary)
  );

  msg.reply({ embeds: [embed], components: [btn] });
});

// =============================================================
// USER CLICKS REGISTER BUTTON → START DM FORM
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const [id, userid] = interaction.customId.split("_");
  if (id !== "regstart") return;

  if (interaction.user.id !== userid)
    return interaction.reply({ content: "❌ This button is not for you!", ephemeral: true });

  try {
    await interaction.reply({ content: "📩 Check your DM!", ephemeral: true });

    const user = interaction.user;
    await user.send("📝 **Welcome to Tournament Registration!**\nLet's start your form.");

    // Start step 1
    formStep[userid] = 1;
    formData[userid] = {};

    user.send("**Step 1:** Enter your **Team Name**:");
  } catch {
    interaction.reply({ content: "❌ I cannot DM you. Please enable your DMs!", ephemeral: true });
  }
});

// =============================================================
// HANDLE DM FORM STEPS
// =============================================================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.type !== 1) return; // Only DM

  const userid = msg.author.id;
  const step = formStep[userid];
  if (!step) return;

  const text = msg.content;

  // ---------- STEP 1 ----------
  if (step === 1) {
    formData[userid].teamName = text;
    formStep[userid] = 2;
    return msg.channel.send("**Step 2:** Enter **Leader Name**:");
  }

  // ---------- STEP 2 ----------
  if (step === 2) {
    formData[userid].leaderName = text;
    formStep[userid] = 3;
    return msg.channel.send("**Step 3:** Enter **Leader UID**:");
  }

  // ---------- STEP 3 ----------
  if (step === 3) {
    formData[userid].leaderUID = text;
    formStep[userid] = 4;
    return msg.channel.send("**Step 4:** Enter your **Discord Username**:");
  }

  // ---------- STEP 4 ----------
  if (step === 4) {
    formData[userid].discordName = text;
    formStep[userid] = 5;
    return msg.channel.send("**Step 5:** Enter **Player 1 (Name + UID)**:");
  }

  // ---------- PLAYER 1 ----------
  if (step === 5) {
    formData[userid].p1 = text;
    formStep[userid] = 6;
    return msg.channel.send("**Player 2 (Name + UID):**");
  }

  // ---------- PLAYER 2 ----------
  if (step === 6) {
    formData[userid].p2 = text;
    formStep[userid] = 7;
    return msg.channel.send("**Player 3 (Name + UID):**");
  }

  // ---------- PLAYER 3 ----------
  if (step === 7) {
    formData[userid].p3 = text;
    formStep[userid] = 8;
    return msg.channel.send("**Player 4 (Name + UID):**");
  }

  // ---------- PLAYER 4 (FINAL) ----------
  if (step === 8) {
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

    msg.channel.send("✅ **Your registration has been submitted!**");

    registered.add(userid);
    delete formStep[userid];
    delete formData[userid];
  }
});

// =============================================================
// APPROVE / REJECT HANDLER
// =============================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.channel.id !== APPROVE_CHANNEL) return;

  if (!interaction.member.roles.cache.has(APPROVER_ROLE))
    return interaction.reply({ content: "❌ You cannot approve this request.", ephemeral: true });

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

    const reason = collected.first()?.content || "No reason given";
    collected.first()?.delete().catch(() => {});

    user.send(`❌ Your registration was **rejected**.\n**Reason:** ${reason}`);
    interaction.followUp({ content: `❌ Rejected (${reason})`, ephemeral: true });
  }
});

// =============================================================
client.login(process.env.TOKEN);
