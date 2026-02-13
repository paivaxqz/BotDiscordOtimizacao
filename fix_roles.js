const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log('[BOT] Iniciando organização de hierarquia em todos os servidores...');
    try {
        const guilds = await client.guilds.fetch();
        for (const [guildId, oGuild] of guilds) {
            const guild = await oGuild.fetch();
            console.log(`[GUILD] Processando: ${guild.name}`);
            const roles = await guild.roles.fetch();
            let count = 0;
            for (const [roleId, role] of roles) {
                // Não mexe em cargos integrados (@everyone, bots) e foca apenas nos que estão com hoist: false
                if (!role.managed && role.name !== '@everyone' && !role.hoist) {
                    try {
                        await role.edit({ hoist: true });
                        console.log(`  - Cargo organizado: ${role.name}`);
                        count++;
                    } catch (e) {
                        console.log(`  - Falha ao editar: ${role.name} (O cargo do bot pode estar abaixo deste)`);
                    }
                }
            }
            console.log(`[GUILD] Sucesso! ${count} cargos atualizados em ${guild.name}.`);
        }
    } catch (err) {
        console.error('[ERRO]', err);
    }
    console.log('[BOT] Tarefa concluída.');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
