const {
    ButtonBuilder,
    ButtonStyle,
    SectionBuilder,
    TextDisplayBuilder,
    ContainerBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');

async function setupTicketSystem(client, channelId) {
    console.log(`[SETUP] Iniciando setup de ticket no canal ${channelId}...`);
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
        console.error("[SETUP] Canal não encontrado!");
        return false;
    }

    try {
        console.log("[SETUP] Limpando mensagens antigas do bot...");
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        if (botMessages.size > 0) {
            await channel.bulkDelete(botMessages);
            console.log(`[SETUP] ${botMessages.size} mensagens antigas deletadas.`);
        }

        console.log("[SETUP] Construindo painel atualizado...");

        // 1. Logo
        const assetsPath = path.join(__dirname, '../assets/icons');
        let logoFile = null;
        if (fs.existsSync(assetsPath)) {
            const files = fs.readdirSync(assetsPath);
            const found = files.find(f => f.toLowerCase().includes('logo') || f.toLowerCase().includes('orbyon'));
            if (found) logoFile = new AttachmentBuilder(path.join(assetsPath, found), { name: 'logo.png' });
            else {
                const pngs = files.filter(f => f.endsWith('.png'));
                if (pngs.length > 0) logoFile = new AttachmentBuilder(path.join(assetsPath, pngs[0]), { name: 'logo.png' });
            }
        }

        // 2. Texto
        const titleText = new TextDisplayBuilder()
            .setContent(`# Atendimento - Suporte Oficial`);

        const descriptionText = new TextDisplayBuilder()
            .setContent(`Seja bem-vindo(a) ao sistema de atendimento! Aqui você pode falar diretamente com nossa equipe.\n\n` +
                `☑️ Forneça o máximo de detalhes possíveis.\n` +
                `☑️ Não contate a equipe no privado.\n` +
                `☑️ Aguarde o atendimento ser iniciado.`);

        // Helper para achar emoji
        const getEmoji = (name, fallback) => {
            const emoji = client.emojis.cache.find(e => e.name === name);
            return emoji ? emoji.toString() : fallback;
        };

        // 3. Dropdown
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Escolha uma categoria')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Suporte Técnico').setValue('tech_support').setEmoji('🛠️'),
                new StringSelectMenuOptionBuilder().setLabel('Financeiro').setValue('finance').setEmoji('💲'),
                new StringSelectMenuOptionBuilder().setLabel('Dúvidas Gerais').setValue('general').setEmoji('❓'),
                new StringSelectMenuOptionBuilder().setLabel('Denúncias').setValue('report').setEmoji('🚨')
            );

        const rowDropdown = new ActionRowBuilder().addComponents(selectMenu);

        // 4. Container
        const container = new ContainerBuilder()
            .setAccentColor(0x5865F2)
            .addTextDisplayComponents(titleText, descriptionText)
            .addActionRowComponents(rowDropdown);

        const payload = {
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            files: []
        };

        if (logoFile) payload.files.push(logoFile);

        await channel.send(payload);
        console.log("[SETUP] Painel enviado com sucesso!");
        return true;

    } catch (error) {
        console.error("[SETUP] Erro:", error);
        return false;
    }
}

module.exports = { setupTicketSystem };
