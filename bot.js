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
  TextInputStyle,
  InteractionType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ENV CONFIG
const REG_CHANNEL = process.env.REG_CHANNEL;            
const APPROVE_CHANNEL = process.env.APPROVE_CHANNEL;    
const APPROVER_ROLE = process.env.APPROVER_ROLE;        

let registered = new Set(); // একবার রেজিস্টার সেভ থাকবে

// ============================
// SEND APPLY BUTTON IN REG_CHANNEL
// ============================
client.once("ready", async () => {
  const channel = client.channels.cache.get(REG_CHANNEL);
  if (!channel) return console.log("Registration channel not found");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_registration")
      .setLabel("Apply")
      .setStyle(ButtonStyle.Primary)
  );

  channel.send({
    content: "Click the button below to apply:",
    components: [row],
  });

  console.log("Bot is ready and Apply button sent!");
});

// ============================
// BUTTON CLICK => OPEN MODAL
// ============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "open_registration") return;

  if (registered.has(interaction.user.id)) {
    return interaction.reply({ content: "❌ You have already registered.", ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId("reg_form")
    .setTitle("Tournament Registration");

  // Form fields (same as before)
  const teamName = new TextInputBuilder()
    .setCustomId("teamName")
    .setLabel("Team Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const leaderName = new TextInputBuilder()
    .setCustomId("leaderName")
    .setLabel("Leader Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const leaderUID = new TextInputBuilder()
    .setCustomId("leaderUID")
    .setLabel("Leader UID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const discordUser = new TextInputBuilder()
    .setCustomId("discordUser")
    .setLabel("Discord Username")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player1Name = new TextInputBuilder()
    .setCustomId("player1Name")
    .setLabel("Player 1 Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player1UID = new TextInputBuilder()
    .setCustomId("player1UID")
    .setLabel("Player 1 UID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player2Name = new TextInputBuilder()
    .setCustomId("player2Name")
    .setLabel("Player 2 Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player2UID = new TextInputBuilder()
    .setCustomId("player2UID")
    .setLabel("Player 2 UID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player3Name = new TextInputBuilder()
    .setCustomId("player3Name")
    .setLabel("Player 3 Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player3UID = new TextInputBuilder()
    .setCustomId("player3UID")
    .setLabel("Player 3 UID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player4Name = new TextInputBuilder()
    .setCustomId("player4Name")
    .setLabel("Player 4 Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const player4UID = new TextInputBuilder()
    .setCustomId("player4UID")
    .setLabel("Player 4 UID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(teamName),
    new ActionRowBuilder().addComponents(leaderName),
    new ActionRowBuilder().addComponents(leaderUID),
    new ActionRowBuilder().addComponents(discordUser),
    new ActionRowBuilder().addComponents(player1Name),
    new ActionRowBuilder().addComponents(player1UID),
    new ActionRowBuilder().addComponents(player2Name),
    new ActionRowBuilder().addComponents(player2UID),
    new ActionRowBuilder().addComponents(player3Name),
    new ActionRowBuilder().addComponents(player3UID),
    new ActionRowBuilder().addComponents(player4Name),
    new ActionRowBuilder().addComponents(player4UID)
  );

  await interaction.showModal(modal);
});

// ============================
// FORM SUBMISSION & APPROVE/REJECT
// ============================
client.on("interactionCreate", async (interaction) => {
  // Modal Submit
  if (interaction.isModalSubmit() && interaction.customId === "reg_form") {
    const data = {
      teamName: interaction.fields.getTextInputValue("teamName"),
      leaderName: interaction.fields.getTextInputValue("leaderName"),
      leaderUID: interaction.fields.getTextInputValue("leaderUID"),
      discordUser: interaction.fields.getTextInputValue("discordUser"),
      player1Name: interaction.fields.getTextInputValue("player1Name"),
      player1UID: interaction.fields.getTextInputValue("player1UID"),
      player2Name: interaction.fields.getTextInputValue("player2Name"),
      player2UID: interaction.fields.getTextInputValue("player2UID"),
      player3Name: interaction.fields.getTextInputValue("player3Name"),
      player3UID: interaction.fields.getTextInputValue("player3UID"),
      player4Name: interaction.fields.getTextInputValue("player4Name"),
      player4UID: interaction.fields.getTextInputValue("player4UID"),
    };

    const approveChannel = interaction.guild.channels.cache.get(APPROVE_CHANNEL);
    if (!approveChannel)
      return interaction.reply({ content: "❌ Approve channel not found!", ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle(`📝 New Registration: ${data.teamName}`)
      .setColor("Blue")
      .addFields(
        { name: "Team Name", value: data.teamName },
        { name: "Leader", value: `${data.leaderName} (${data.leaderUID})` },
        { name: "Discord Username", value: data.discordUser },
        { name: "Player 1", value: `${data.player1Name} (${data.player1UID})` },
        { name: "Player 2", value: `${data.player2Name} (${data.player2UID})` },
        { name: "Player 3", value: `${data.player3Name} (${data.player3UID})` },
        { name: "Player 4", value: `${data.player4Name} (${data.player4UID})` }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${interaction.user.id}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${interaction.user.id}`)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
    );

    await approveChannel.send({ embeds: [embed], components: [row] });
    registered.add(interaction.user.id);

    return interaction.reply({ content: "✅ Your registration has been submitted for review!", ephemeral: true });
  }

  // Approve/Reject buttons
  if (!interaction.isButton()) return;
  if (interaction.channel.id !== APPROVE_CHANNEL) return;
  if (!interaction.member.roles.cache.has(APPROVER_ROLE))
    return interaction.reply({ content: "❌ You don't have permission.", ephemeral: true });

  const [type, userid] = interaction.customId.split("_");
  const user = await interaction.guild.members.fetch(userid).catch(() => null);
  if (!user) return interaction.reply({ content: "User no longer exists.", ephemeral: true });

  if (type === "approve") {
    await interaction.reply({ content: `✅ Approved by <@${interaction.user.id}>`, ephemeral: true });
    user.send("🎉 **Congratulations! Your registration has been APPROVED!**").catch(() => {});
  }

  if (type === "reject") {
    await interaction.reply({ content: "❌ Please type reject reason:", ephemeral: true });
    const filter = m => m.author.id === interaction.user.id;
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
    const reason = collected.first()?.content || "No reason provided";
    if (collected.first()) collected.first().delete().catch(() => {});

    user.send(`❌ Your registration was **REJECTED**.\n**Reason:** ${reason}`).catch(() => {});
    interaction.followUp({ content: `❌ Rejected.\nReason: **${reason}**`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
