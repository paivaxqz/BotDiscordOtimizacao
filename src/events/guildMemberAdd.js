const {
    Events,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    SectionBuilder,
    TextDisplayBuilder,
    ContainerBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Collection
} = require('discord.js');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        console.log(`[DEBUG] Evento guildMemberAdd disparado para: ${member.user.tag}`);

        const db = require('../database');
        const config = db.getGuild(member.guild.id);

        // 1. Auto Role
        if (config.auto_role_id) {
            try {
                await member.roles.add(config.auto_role_id);
                console.log(`[DEBUG] Auto Role ${config.auto_role_id} adicionado para ${member.user.tag}`);
            } catch (err) {
                console.error(`[ERRO] Falha ao dar Auto Role: ${err.message}`);
            }
        }

        // 2. Welcome Message
        if (!config.welcome_channel_id) return;

        const channel = member.guild.channels.cache.get(config.welcome_channel_id);
        if (!channel) return;

        // --- 3. INVITE TRACKER LOGIC (FASE 23) ---
        let inviterText = "desconhecido";
        try {
            const newInvites = await member.guild.invites.fetch();
            const oldInvites = member.client.invites.get(member.guild.id) || new Collection();

            // Encontrar o convite que aumentou
            const invite = newInvites.find(i => (oldInvites.get(i.code) || 0) < i.uses);

            // Atualizar cache
            member.client.invites.set(member.guild.id, new Collection(newInvites.map(i => [i.code, i.uses])));

            if (invite) {
                const inviter = invite.inviter;
                const totalUses = newInvites.filter(i => i.inviter?.id === inviter?.id).reduce((acc, inv) => acc + inv.uses, 0);
                inviterText = `${inviter ? inviter.username : "convite deletado"} que tem agora ${totalUses} invites`;

                // Mensagem de Log Estilizada (Matching Screenshot)
                const inviteLogChannelId = "1471552550183764016"; // Canal #invites (Ajustar se necessário)
                const logChannel = member.guild.channels.cache.get(inviteLogChannelId) || channel;

                await logChannel.send({
                    content: `${member.toString()} foi convidado por **${inviter ? inviter.username : "alguém"}** que tem agora **${totalUses}** invites.`
                });
            }
        } catch (e) { console.error("[ERRO INVITE TRACKER]", e); }

        try {
            // Helpers de Assets (Mantido)
            const assetsPath = path.join(__dirname, '../../assets/icons');
            const getIcon = (searchTerm) => {
                if (!fs.existsSync(assetsPath)) return null;
                const files = fs.readdirSync(assetsPath);
                const file = files.find(f => f.toLowerCase().includes(searchTerm.toLowerCase()) && f.endsWith('.png'));
                if (file) return new AttachmentBuilder(path.join(assetsPath, file), { name: file });
                return null;
            };
            const welcomeIcon = getIcon('welcome') || getIcon('account-plus') || getIcon('account');

            // --- WELCOME MESSAGE LOGIC ---
            const welcomeConfig = config.welcome_message;

            // Helper for variable replacement
            const replaceVars = (text) => {
                if (!text) return text;
                return text
                    .replace(/{user}/g, member.user.username)
                    .replace(/{user_mention}/g, `<@${member.user.id}>`)
                    .replace(/{user_tag}/g, member.user.tag)
                    .replace(/{user_id}/g, member.user.id)
                    .replace(/{user_avatar}/g, member.user.displayAvatarURL({ extension: 'png', size: 1024 }))
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{server_name}/g, member.guild.name)
                    .replace(/{server_icon}/g, member.guild.iconURL({ extension: 'png', size: 1024 }) || '')
                    .replace(/{member_count}/g, member.guild.memberCount.toString());
            };

            let payload;

            if (welcomeConfig) {
                // USE CUSTOM CONFIGURATION (Legacy/Manual)
                const embedData = welcomeConfig.embed;
                const configContainer = new ContainerBuilder()
                    .setAccentColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0x5865F2);

                const textComponents = [];
                if (embedData.title) textComponents.push(new TextDisplayBuilder().setContent(`# ${replaceVars(embedData.title)}`));
                if (embedData.description) textComponents.push(new TextDisplayBuilder().setContent(replaceVars(embedData.description)));
                if (textComponents.length > 0) configContainer.addTextDisplayComponents(...textComponents);

                configContainer.setThumbnailAccessory(new AttachmentBuilder(embedData.thumbnail || member.user.displayAvatarURL({ extension: 'png', size: 256 })));
                if (embedData.footer && embedData.footer.text) configContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`_${replaceVars(embedData.footer.text)}_`).setColor('subtext'));

                payload = {
                    content: replaceVars(welcomeConfig.content) || '',
                    flags: MessageFlags.IsComponentsV2,
                    components: [configContainer]
                };

            } else {
                // --- PREMIUM WELCOME LAYOUT V2 (JsOptimizer Style - Default) ---
                const welcomeGifUrl = 'https://media.discordapp.net/attachments/1471101824765239327/1471556952895281303/7f8f6354898ea06b.gif';

                const premiumContainer = new ContainerBuilder()
                    .setAccentColor(0x512DA8) // Premium Purple
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# 👋 Bem-vindo(a) à JsOptimizer!`),
                        new TextDisplayBuilder().setContent(
                            `Seja bem-vindo(a), ${member.user.toString()}! Estamos prontos para extrair o máximo do seu hardware.\n\n` +
                            `> 👤 **Membro**: #${member.guild.memberCount}\n` +
                            `> ⚡ **Início**: Leia <#1471552552943485174> para começar.`
                        )
                    );

                premiumContainer.addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Conhecer Planos').setStyle(ButtonStyle.Link).setURL('https://discord.com/channels/1471279007571116106/1471552552943485174'),
                        new ButtonBuilder().setLabel('Suporte').setStyle(ButtonStyle.Link).setURL('https://discord.com/channels/1471279007571116106/1471552599952982017')
                    )
                );

                payload = {
                    flags: MessageFlags.IsComponentsV2,
                    components: [premiumContainer]
                };
            }

            console.log(`[DEBUG] Enviando welcome V2...`);
            await channel.send(payload);

        } catch (error) {
            console.error("[ERRO CRÍTICO NO WELCOME]", error);
        }
    },
};
