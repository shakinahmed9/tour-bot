require('dotenv').config();
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
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ENV variables
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;
const REG_CHANNEL = process.env.REG_CHANNEL;
const REVIEW_CHANNEL = process.env.REVIEW_CHANNEL;

client.once("ready", () => {
    console.log("Bot is running as " + client.user.tag);
});

// Slash Command Interaction
client.on("interactionCreate", async interaction => {

    // ----------------------------
    //      OPEN REG MODAL
    // ----------------------------
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "register") {

            if (interaction.channel.id !== REG_CHANNEL) {
                return interaction.reply({ 
                    content: "❌ You must register in the official registration channel!",
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId("team_form")
                .setTitle("Tournament Registration");

            const teamName = new TextInputBuilder()
                .setCustomId('teamName')
                .setLabel("Team Name")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const p1 = new TextInputBuilder().setCustomId('p1').setLabel("Player 1 Name & UID").setStyle(TextInputStyle.Short).setRequired(true);
            const p2 = new TextInputBuilder().setCustomId('p2').setLabel("Player 2 Name & UID").setStyle(TextInputStyle.Short).setRequired(true);
            const p3 = new TextInputBuilder().setCustomId('p3').setLabel("Player 3 Name & UID").setStyle(TextInputStyle.Short).setRequired(true);
            const p4 = new TextInputBuilder().setCustomId('p4').setLabel("Player 4 Name & UID").setStyle(TextInputStyle.Short).setRequired(true);
            const p5 = new TextInputBuilder().setCustomId('p5').setLabel("Player 5 Name & UID").setStyle(TextInputStyle.Short).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(teamName),
                new ActionRowBuilder().addComponents(p1),
                new ActionRowBuilder().addComponents(p2),
                new ActionRowBuilder().addComponents(p3),
                new ActionRowBuilder().addComponents(p4),
                new ActionRowBuilder().addComponents(p5)
            );

            return interaction.showModal(modal);
        }
    }

    // ----------------------------
    //       MODAL SUBMIT
    // ----------------------------
    if (interaction.isModalSubmit() && interaction.customId === "team_form") {

        if (interaction.channel.id !== REG_CHANNEL) {
            return interaction.reply({ 
                content: "❌ Registration only allowed in official registration channel!", 
                ephemeral: true 
            });
        }

        const teamName = interaction.fields.getTextInputValue("teamName");

        const players = [
            interaction.fields.getTextInputValue("p1"),
            interaction.fields.getTextInputValue("p2"),
            interaction.fields.getTextInputValue("p3"),
            interaction.fields.getTextInputValue("p4"),
            interaction.fields.getTextInputValue("p5")
        ];

        await interaction.reply({ 
            content: "📸 Please upload **5 screenshots** here (one message = one screenshot).", 
            ephemeral: true 
        });

        const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
        const msgs = await interaction.channel.awaitMessages({ filter, max: 5, time: 90000 });

        const screenshots = msgs.map(m => m.attachments.first().url);

        const embed = new EmbedBuilder()
            .setTitle(`New Registration — ${teamName}`)
            .setDescription(`Submitted by <@${interaction.user.id}>`)
            .addFields({ name: "Players", value: players.join("\n") })
            .setColor("Blue")
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("approve").setLabel("Approve").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("reject").setLabel("Reject").setStyle(ButtonStyle.Danger)
        );

        const reviewChannel = await client.channels.fetch(REVIEW_CHANNEL);

        reviewChannel.send({
            embeds: [embed],
            files: screenshots,
            components: [row]
        });
    }

    // ----------------------------
    //        APPROVE / REJECT
    // ----------------------------
    if (interaction.isButton()) {

        if (!interaction.member.roles.cache.has(OWNER_ROLE_ID)) {
            return interaction.reply({
                content: "❌ You are not allowed to approve or reject applications!",
                ephemeral: true
            });
        }

        if (interaction.customId === "approve") {
            return interaction.reply({ content: "✅ Application Approved!", ephemeral: true });
        }

        if (interaction.customId === "reject") {
            return interaction.reply({ content: "❌ Application Rejected!", ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
