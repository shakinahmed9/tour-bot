require('dotenv').config();
const PREFIX = '!';
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});


client.once('ready', () => {
console.log(`Bot Logged in as ${client.user.tag}`);
});


client.on('messageCreate', async (message) => {
if (message.author.bot) return;
if (!message.content.startsWith(PREFIX)) return;


const args = message.content.slice(PREFIX.length).trim().split(/ +/);
const cmd = args.shift().toLowerCase();
const data = readData();


if (cmd === 'start-registration') {
data.open = true;
writeData(data);
return message.channel.send('📢 Registration is **OPEN** now!');
}


if (cmd === 'end-registration') {
data.open = false;
writeData(data);
return message.channel.send('🚫 Registration is **CLOSED**');
}


if (cmd === 'register') {
if (!data.open) return message.reply('Registration is closed!');


const teamName = args.shift();
const playersRaw = args.join(' ');
if (!teamName || !playersRaw) return message.reply('Usage: !register <TeamName> <Player1,Player2,...>');


const players = playersRaw.split(',').map(p => p.trim()).filter(Boolean);


if (data.teams.find(t => t.teamName.toLowerCase() === teamName.toLowerCase())) {
return message.reply('⚠️ Team already registered.');
}


const team = {
teamName,
players,
registeredBy: message.author.id,
time: new Date().toISOString()
};


data.teams.push(team);
writeData(data);


return message.channel.send(`✅ Team **${teamName}** registered with ${players.length} players.`);
}


if (cmd === 'list-teams') {
if (data.teams.length === 0) return message.channel.send('No teams registered yet.');


const out = data.teams
.map((t, i) => `${i + 1}. **${t.teamName}** — ${t.players.join(', ')}`)
.join('
');


return message.channel.send(out.slice(0, 1900));
}


if (cmd === 'export') {
return message.channel.send({
files: [{ attachment: DATA_FILE, name: 'registrations.json' }]
});
}
});


client.login(process.env.DISCORD_TOKEN);
