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
} = require("discord.js");

// ---------------- BOT CLIENT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ---------------- ENV ----------------
const TOKEN = process.env.TOKEN;
const REG_CHANNEL = process.env.REG_CHANNEL;
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;
const APPROVER_ROLE = process.env.APPROVER_ROLE;
const REQUIRE_ROLE = process.env.REQUIRE_ROLE || null;

const FILE = path.join(__dirname, "tournament_registrations.json");

// ---------------- STORAGE ----------------
let data = { pending: {}, approved: {}, rejected: {} };

(async () => {
  if (!(await fs.pathExists(FILE))) {
    await fs.writeJson(FILE, data, { spaces: 2 });
  } else data = await fs.readJson(FILE);
})();

const save = () => fs.writeJson(FILE, data, { spaces: 2 });

// ---------------- QUESTIONS ----------------
const FORM = [
  { id: "teamName", q: "Team Name:" },
  { id: "leaderName", q: "Leader Name:" },
  { id: "leaderUID", q: "Leader UID:" },
  { id: "discord", q: "Discord Username:" },
  { id: "p1", q: "Player 1 UID:" },
  { id: "p2", q: "Player 2 UID:" },
  { id: "p3", q: "Player 3 UID:" },
  { id: "p4", q: "Player 4 UID:" },
];

// -------------------------------------------------------
// 📌 USER MESSAGE IN REG CHANNEL → SHOW REGISTRATION UI
// -------------------------------------------------------
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== REG_CHANNEL) return;

  if (REQUIRE_ROLE && !msg.member.roles.cache.has(REQUIRE_ROLE)) {
    return msg.reply("❌ You cannot register.");
  }

  if (data.pending[msg.author.id] || data.approved[msg.author.id]) {
    return msg.reply("❌ You already registered.");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`register_${msg.author.id}`)
    .setPlaceholder("Select Application")
    .addOptions([{ label: "Free Fire Tournament", value: "ff" }]);

  const UI = new ActionRowBuilder().addComponents(menu);

  const embed = new EmbedBuilder()
    .setTitle("Tournament Registration")
    .setDescription(
      `Are you sure you want to register?\n\nOnce started, you will receive questions in DM.\nYou have **3 hours** to finish.\nYou can type **cancel** anytime.`
    )
    .setColor("Blue");

  msg.reply({ embeds: [embed], components: [UI] });
});

// -------------------------------------------------------
// 📩 USER SELECTS DROPDOWN → START DM FORM
// -------------------------------------------------------
client.on("interactionCreate", async (i) => {
  if (!i.isStringSelectMenu()) return;

  const [action, userId] = i.customId.split("_");
  if (action !== "register" || i.user.id !== userId)
    return i.reply({ content: "❌ Not for you.", ephemeral: true });

  await i.reply({ content: "📩 Check your DMs!", ephemeral: true });

  startForm(i.user);
});

// -------------------------------------------------------
// 📝 FORM SYSTEM (fixed for v14)
// -------------------------------------------------------
async function startForm(user) {
  if (data.pending[user.id]) return user.send("⚠ Already pending.");

  let record = {};

  await user.send("📝 Tournament Registration Started.\nType `cancel` anytime.");

  for (const q of FORM) {
    await user.send(`**${q.q}**`);

    const collected = await user.dmChannel.awaitMessages({
      filter: (m) => m.author.id === user.id,
      max: 1,
      time: 180000,
    });

    if (!collected.size) return user.send("⏳ Timeout. Start again.");

    const msg = collected.first();

    if (msg.content.toLowerCase() === "cancel") return user.send("❌ Cancelled.");

    record[q.id] = msg.content;
  }

  submitToPanel(user, record);
}

// -------------------------------------------------------
// 📤 SEND TO ADMIN PANEL
// -------------------------------------------------------
async function submitToPanel(user, record) {
  const ch = await client.channels.fetch(APPROVE_CHANNEL);

  const embed = new EmbedBuilder()
    .setTitle("📥 New Tournament Registration")
    .setDescription(`Applicant: <@${user.id}>`)
    .setColor("Aqua")
    .setTimestamp();

  FORM.forEach((i) => {
    embed.addFields({ name: i.q, value: record[i.id] || "N/A" });
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve-${user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject-${user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
  );

  const msg = await ch.send({ embeds: [embed], components: [row] });

  data.pending[user.id] = { record, messageId: msg.id };
  save();

  user.send("✅ Submitted! Use `status` anytime.");
}

// -------------------------------------------------------
// 🛠 ADMIN APPROVE / REJECT
// -------------------------------------------------------
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const [action, userId] = i.customId.split("-");
  if (!i.member.roles.cache.has(APPROVER_ROLE))
    return i.reply({ content: "❌ You can't do that.", ephemeral: true });

  if (!data.pending[userId])
    return i.reply({ content: "⚠ Already processed.", ephemeral: true });

  const user = await client.users.fetch(userId);

  const disabled = new ActionRowBuilder().addComponents(
    i.message.components[0].components.map((b) => ButtonBuilder.from(b).setDisabled(true))
  );

  await i.message.edit({ components: [disabled] });

  if (action === "approve") {
    data.approved[userId] = data.pending[userId];
    delete data.pending[userId];
    save();
    i.reply("✅ Approved.");
    user.send("🎉 Your team is approved!");
  } else {
    delete data.pending[userId];
    save();
    i.reply("❌ Rejected.");
    user.send("❌ Your registration was rejected.");
  }
});

// -------------------------------------------------------
client.once("ready", () => console.log(`BOT READY: ${client.user.tag}`));
client.login(TOKEN);
