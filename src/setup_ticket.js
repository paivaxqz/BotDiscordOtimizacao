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
            const found = files.find(f => f.toLowerCase().includes('logo'));
            if (found) logoFile = new AttachmentBuilder(path.join(assetsPath, found), { name: 'logo.png' });
            else {
                const pngs = files.filter(f => f.endsWith('.png'));
                if (pngs.length > 0) logoFile = new AttachmentBuilder(path.join(assetsPath, pngs[0]), { name: 'logo.png' });
            }
        }

        // 2. Texto
        const titleText = new TextDisplayBuilder()
            .setContent(`# Sistema de Tickets - Support`);

        const descriptionText = new TextDisplayBuilder()
            .setContent(`Ticket é um canal privado entre você e os Staffs. Nele, você pode tirar dúvidas sobre os produtos, solicitar instalação, receber produtos comprados, etc... Todo nosso atendimento é feito por aqui, não atendemos no privado.\n\n` +
                `Seja objetivo na sua dúvida ou no motivo de abertura, caso o ticket seja aberto e nenhuma mensagem for enviada, ele será deletado.`);

        // Helper para achar emoji
        const getEmoji = (name, fallback) => {
            const emoji = client.emojis.cache.find(e => e.name === name);
            return emoji ? emoji.toString() : fallback;
        };

        // 3. Botões
        const buyButton = new ButtonBuilder()
            .setCustomId('ticket_buy')
            .setLabel('Buy')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('1474517093650268473');

        const reinstallButton = new ButtonBuilder()
            .setCustomId('ticket_reinstall')
            .setLabel('Reinstall')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('1474512441600774174');

        const doubtsButton = new ButtonBuilder()
            .setCustomId('ticket_doubts')
            .setLabel('Dúvidas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('1457935131892383776');

        const rowButtons = new ActionRowBuilder().addComponents(buyButton, reinstallButton, doubtsButton);

        // 4. Container
        const container = new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(titleText, descriptionText)
            .addActionRowComponents(rowButtons);

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

async function createTicketCategories(guild) {
    try {
        const categories = [
            { name: '🛒 BUY', description: 'Tickets de compras' },
            { name: '🔧 REINSTALL', description: 'Tickets de reinstalação' },
            { name: '❓ DÚVIDAS', description: 'Tickets de suporte' }
        ];

        for (const cat of categories) {
            // Verifica se categoria já existe
            const existingCategory = guild.channels.cache.find(c => 
                c.name === cat.name && c.type === 4 // 4 = Category
            );

            if (!existingCategory) {
                // Pega a posição do canal de tickets atual como referência
                const ticketChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('ticket'));
                const position = ticketChannel ? ticketChannel.position : 0;

                await guild.channels.create({
                    name: cat.name,
                    type: 4, // Category
                    position: position + 1,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: ['ViewChannel']
                        },
                        {
                            id: guild.client.user.id,
                            allow: ['ViewChannel', 'SendMessages', 'ManageChannels']
                        }
                    ]
                });
                console.log(`[SETUP] Categoria '${cat.name}' criada com sucesso!`);
            } else {
                console.log(`[SETUP] Categoria '${cat.name}' já existe.`);
            }
        }
    } catch (error) {
        console.error('[SETUP] Erro ao criar categorias:', error);
    }
}

module.exports = { setupTicketSystem };
