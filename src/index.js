require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember, Partials.User]
});

// Event Handler
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
} else {
    console.warn("Pasta 'events' não encontrada.");
}

// Anti-Raid System (Manual)
const antiRaidEvent = require('./anti_raid');
const antiRaid = antiRaidEvent.antiRaid;

// Apenas o evento de member leave para tickets (anti-raid manual)
client.on('guildMemberRemove', (member) => antiRaid.handleMemberLeave(member));

console.log("[ANTI-RAID] Sistema anti-raid em modo manual. Use /antiraid para ativar/desativar.");


client.invites = new Collection();

client.login(process.env.DISCORD_TOKEN).then(async () => {
    console.log(`Logado como ${client.user.tag}!`);

    // Carregar convites de todas as guildas para o cache
    for (const guild of client.guilds.cache.values()) {
        try {
            const invites = await guild.invites.fetch();
            client.invites.set(guild.id, new Collection(invites.map(inv => [inv.code, inv.uses])));
            console.log(`[DEBUG] Cache de convites carregado para: ${guild.name} (${invites.size} convites)`);
        } catch (err) {
            console.error(`[ERRO] Falha ao carregar convites para ${guild.name}:`, err.message);
        }

        // Arrumar hierarquia automaticamente (Sidebar Setup)
        try {
            const roles = await guild.roles.fetch();
            let hCount = 0;
            for (const [, role] of roles) {
                if (!role.managed && role.name !== '@everyone' && !role.hoist) {
                    await role.edit({ hoist: true }).catch(() => { });
                    hCount++;
                }
            }
            if (hCount > 0) console.log(`[HIERARQUIA] ${hCount} cargos organizados em: ${guild.name}`);
        } catch (err) {
            console.error(`[ERRO] Falha ao organizar cargos em ${guild.name}:`, err.message);
        }
    }
}).catch(err => {
    console.error("Erro ao logar:", err);
});
