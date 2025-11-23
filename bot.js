require('dotenv').config();
.setLabel('Team Name')
.setStyle(TextInputStyle.Short)
.setRequired(true);


const p1 = new TextInputBuilder().setCustomId('p1').setLabel('Player 1 Name & UID').setStyle(TextInputStyle.Short).setRequired(true);
const p2 = new TextInputBuilder().setCustomId('p2').setLabel('Player 2 Name & UID').setStyle(TextInputStyle.Short).setRequired(true);
const p3 = new TextInputBuilder().setCustomId('p3').setLabel('Player 3 Name & UID').setStyle(TextInputStyle.Short).setRequired(true);
const p4 = new TextInputBuilder().setCustomId('p4').setLabel('Player 4 Name & UID').setStyle(TextInputStyle.Short).setRequired(true);
const p5 = new TextInputBuilder().setCustomId('p5').setLabel('Player 5 Name & UID').setStyle(TextInputStyle.Short).setRequired(true);


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


// Modal Submit
if (interaction.isModalSubmit && interaction.customId === "apply_form") {
// --- Restrict submissions to registration channel only ---
if (interaction.channel.id !== REG_CHANNEL) {
return interaction.reply({ content: "❌ Registration only allowed in the official registration channel!", ephemeral: true });
}() && interaction.customId === 'team_info') {
const teamName = interaction.fields.getTextInputValue('teamName');


const players = [
interaction.fields.getTextInputValue('p1'),
interaction.fields.getTextInputValue('p2'),
interaction.fields.getTextInputValue('p3'),
interaction.fields.getTextInputValue('p4'),
interaction.fields.getTextInputValue('p5')
];


await interaction.reply({ content: 'Upload 5 screenshots here.', ephemeral: true });


const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
const msgs = await interaction.channel.awaitMessages({ filter, max: 5, time: 60000 });


const screenshots = msgs.map(m => m.attachments.first().url);


const embed = new EmbedBuilder()
.setTitle(`New Application — ${teamName}`)
.setDescription(`Submitted by <@${interaction.user.id}>`)
.addFields(
{ name: 'Players', value: players.join('
') }
)
.setColor('#2ECC71')
.setTimestamp();


const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId('reject').setLabel('Reject').setStyle(ButtonStyle.Danger)
);


const ch = await client.channels.fetch(REVIEW_CHANNEL);
ch.send({ embeds: [embed], files: screenshots, components: [row] });
}


// Accept / Reject
if (interaction.isButton()) {
if (interaction.customId === 'accept') {
return interaction.reply({ content: 'Application Accepted!', ephemeral: true });
}


if (interaction.customId === 'reject') {
return interaction.reply({ content: 'Application Rejected.', ephemeral: true });
}
}
});


client.login(process.env.DISCORD_TOKEN);
