const { Events, AttachmentBuilder, MessageFlags, PermissionsBitField, ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const { beautify } = require('../utils/hardwareBeautifier');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // --- COMANDO +FEEDBACK (PREFIXO V17) ---
        if (message.content.toLowerCase().startsWith('+feedback')) {
            const guildConfig = db.getGuild(message.guild.id);
            const staffRoleId = guildConfig.staff_role_id;

            // 1. Verificar Permissão
            if (staffRoleId && !message.member.roles.cache.has(staffRoleId)) {
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return; // Ignora silenciosamente para não floodar
                }
            }

            // 2. Verificar se é uma Resposta
            if (!message.reference) {
                return message.reply('❌ **Como usar:** Dê `+feedback` **respondendo** à mensagem de recado do cliente!').then(m => setTimeout(() => m.delete(), 5000));
            }

            try {
                const targetMessage = await message.channel.messages.fetch(message.reference.messageId);
                const cliente = targetMessage.author;
                const recado = targetMessage.content;

                // --- SMART SCRAPER (V18) ---
                const history = await message.channel.messages.fetch({ limit: 100 });

                // 1. Identificar Prints por Palavras-Chave
                let imagemAntes = null;
                let imagemDepois = null;

                const antesRegex = /(antes|before|old|anterior)/i;
                const depoisRegex = /(depois|after|next|final|finish|teste|print)/i;

                for (const m of history.values()) {
                    if (m.attachments.size > 0) {
                        const content = m.content.toLowerCase();
                        if (!imagemAntes && antesRegex.test(content)) imagemAntes = m.attachments.first().url;
                        if (!imagemDepois && depoisRegex.test(content)) imagemDepois = m.attachments.first().url;
                    }
                }

                // Fallback: Se não achou por palavra, pega o mais recente de cada um (Staff vs Cliente)
                if (!imagemAntes) {
                    const clientMsg = history.find(m => m.author.id === cliente.id && m.attachments.size > 0);
                    imagemAntes = clientMsg ? clientMsg.attachments.first().url : null;
                }
                if (!imagemDepois) {
                    const staffMsg = history.find(m => m.author.id === message.author.id && m.attachments.size > 0);
                    imagemDepois = staffMsg ? staffMsg.attachments.first().url : null;
                }

                if (!imagemAntes || !imagemDepois) {
                    return message.reply('❌ **Prints não identificadas!** Certifique-se de que enviou as prints com as palavras "antes" e "depois" no chat.').then(m => setTimeout(() => m.delete(), 5000));
                }

                // 2. Sniffer de Configuração (PC Specs)
                let pcConfig = null;
                const hardwareKeywords = ['intel', 'amd', 'ryzen', 'core', 'i3', 'i5', 'i7', 'i9', 'rtx', 'gtx', 'radeon', 'gb', 'ram', 'nvme', 'ssd', 'xeon', 'rx', 'ti', 'super'];

                // Procura na conversa do cliente a mensagem que mais parece uma config
                const clientMessages = history.filter(m => m.author.id === cliente.id && !m.author.bot);
                for (const m of clientMessages.values()) {
                    const content = m.content.toLowerCase();
                    const matchCount = hardwareKeywords.filter(kw => content.includes(kw)).length;
                    if (matchCount >= 2) { // Precisa de pelo menos 2 termos técnicos (ex: i5 e rtx)
                        pcConfig = m.content;
                        break;
                    }
                }

                // Fallback: Puxa do Banco de Dados (se ele preencheu o botão de pagamento)
                if (!pcConfig) {
                    const dbFeedback = guildConfig[`feedback_${cliente.id}`];
                    pcConfig = dbFeedback ? dbFeedback.config : 'PC não informado (Staff check)';
                }

                // 3. Postar Instantaneamente
                const resultsChannelId = guildConfig.results_channel_id;
                if (!resultsChannelId) return message.reply('❌ Canal de resultados não configurado!');

                const resultsChannel = await message.guild.channels.fetch(resultsChannelId);

                const container = new ContainerBuilder()
                    .setAccentColor(0x512DA8)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# 🚀 Performance Showcase`),
                        new TextDisplayBuilder().setContent(`**Snapshot de Feedback de:** ${cliente.toString()}`),
                        new TextDisplayBuilder().setContent(`> **“** ${recado} **”**`),
                        new TextDisplayBuilder().setContent(`\n**📊 Especificações Técnicas**\n\`${pcConfig}\``),
                        new TextDisplayBuilder().setContent(`**⚡ Ganho Constatado**\n\*(Identificado nas prints)*`)
                    );

                const mediaGallery = new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://antes.png'),
                    new MediaGalleryItemBuilder().setURL('attachment://depois.png')
                );
                container.addMediaGalleryComponents(mediaGallery);

                await resultsChannel.send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [container],
                    files: [
                        new AttachmentBuilder(imagemAntes, { name: 'antes.png' }),
                        new AttachmentBuilder(imagemDepois, { name: 'depois.png' })
                    ]
                });

                // Se chegou aqui, postou com sucesso. O resto é perfumaria/limpeza.
                try {
                    await message.delete().catch(() => { });
                    await message.channel.send(`✅ **Resultado de ${cliente.username} postado com sucesso!** Inteligência artificial identificou os dados corretamente.`).then(m => setTimeout(() => m.delete(), 3000));
                } catch (innerError) {
                    console.error("Erro na limpeza do +feedback:", innerError);
                }

            } catch (e) {
                console.error("Erro no +feedback:", e);
                // Só manda erro se não chegou a postar no canal de resultados
                return message.reply('❌ Erro ao postar o resultado. Verifique se as prints e o canal estão corretos.').then(m => setTimeout(() => m.delete(), 5000));
            }
        }

        // --- COMANDO +APROVAR (PREFIXO V22) ---
        if (message.content.toLowerCase().startsWith('+aprovar')) {
            console.log(`[DEBUG] +aprovar detectado no canal ${message.channel.name} por ${message.author.tag}`);
            const guildConfig = db.getGuild(message.guild.id);
            const staffRoleId = guildConfig.staff_role_id;

            // 1. Verificar Permissão
            if (staffRoleId && !message.member.roles.cache.has(staffRoleId)) {
                if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    console.log(`[DEBUG] Usuário ${message.author.tag} sem permissão para +aprovar`);
                    return; // Ignora silenciosamente
                }
            }

            // 2. Identificar Cliente pelo Tópico (Ticket de [ID])
            const topic = message.channel.topic || "";
            console.log(`[DEBUG] Tópico do canal: ${topic}`);
            const userIdMatch = topic.match(/Ticket de.*?(\d+)/);
            if (!userIdMatch) {
                console.log(`[DEBUG] Não foi possível encontrar ID do cliente no tópico: ${topic}`);
                return message.reply('❌ **Erro:** Não consegui identificar o dono deste ticket pelo tópico.').then(m => setTimeout(() => m.delete(), 5000));
            }

            const clienteId = userIdMatch[1];
            try {
                const clienteUser = await message.client.users.fetch(clienteId);

                // 3. Rename Ticket (otm-[username])
                try {
                    const ntName = `otm-${clienteUser.username.toLowerCase()}`;
                    await message.channel.setName(ntName);
                } catch (e) { console.error("Erro ao renomear ticket:", e); }

                // 4. Cleanup: Deletar QR Code anterior
                try {
                    const messages = await message.channel.messages.fetch({ limit: 20 });
                    const pixMsg = messages.find(m => m.author.id === message.client.user.id && (m.content.includes(clienteId) || m.components.some(c => c.components.some(b => b.customId === 'copy_pix_code'))));
                    if (pixMsg) await pixMsg.delete().catch(() => { });
                } catch (e) { }

                // 5. Success Reply V2 (PUBLIC)
                const successContainer = new ContainerBuilder()
                    .setAccentColor(0x512DA8)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`✅ **PAGAMENTO APROVADO MANUALMENTE!**\n\n` +
                            `Olá ${clienteUser.toString()}, seu pagamento foi aprovado pela nossa equipe.\n\n` +
                            `🚀 **PRÓXIMO PASSO:**\n` +
                            `Escreva aqui abaixo: **Qual o seu Processador e sua Placa de Vídeo?**\n` +
                            `*(Ex: i5 10400 e rtx 3060)*`),
                        new TextDisplayBuilder().setContent(`🔊 **Aguardando Suporte:** Entre na call de suporte enquanto a IA identifica seu PC.`)
                    );

                await message.channel.send({
                    content: clienteUser.toString(),
                    flags: MessageFlags.IsComponentsV2,
                    components: [successContainer]
                });

                // Deletar o comando da staff
                await message.delete().catch(() => { });

                // 6. AI CONFIG COLLECTOR
                const filter = m => m.author.id === clienteId;
                const collector = message.channel.createMessageCollector({ filter, max: 1, time: 300000 });

                collector.on('collect', async m => {
                    const rawText = m.content;
                    const beautifiedResult = beautify(rawText);

                    const confirmContainer = new ContainerBuilder()
                        .setAccentColor(0x5865F2)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`🤖 **IA IDENTIFICOU SEU PC!**`),
                            new TextDisplayBuilder().setContent(`Pelo que você mandou, identifiquei esses componentes:\n\n**${beautifiedResult}**`),
                            new TextDisplayBuilder().setContent(`Acertei? Clique no botão abaixo para confirmar ou corrigir.`)
                        );

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_specs_ok_${beautifiedResult}`)
                            .setLabel('Sim, está correto ✅')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('edit_specs_retry')
                            .setLabel('Não, quero corrigir ✏️')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await m.reply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [confirmContainer, row]
                    });
                });

            } catch (err) {
                console.error("Erro no +aprovar:", err);
                return message.reply(`❌ Erro técnico: ${err.message}`).then(m => setTimeout(() => m.delete(), 5000));
            }
        }
    }
};
