const {
    Events,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
const db = require('../database'); // Import Database
const { generateServerStructure } = require('../ai_server_gen.js'); // Import AI Module
const { beautify } = require('../utils/hardwareBeautifier'); // Import Hardware Beautifier

// Store for Embed Builder drafts (in-memory for simplicity)
const embedDrafts = new Map();
const aiSessions = new Map(); // Store AI Context: { userId, theme, history: [] }
const resultDrafts = new Map(); // Store { staffId, clienteId, imagemAntes, imagemDepois }

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        console.log(`[Interaction] Command: ${interaction.commandName || interaction.customId} | User: ${interaction.user.tag} | VER: 2.0`);
        const client = interaction.client;

        // --- HELPERS ---
        const getEmoji = (name, fallback) => {
            const emoji = client.emojis.cache.find(e => e.name === name);
            return emoji ? emoji.id : fallback;
        };
        const getEmojiText = (name, fallback) => {
            const emoji = client.emojis.cache.find(e => e.name === name);
            return emoji ? `<:${emoji.name}:${emoji.id}>` : fallback;
        };

        const emojiBellId = getEmoji('notify_StorM', '🔔');
        const emojiSecurityId = getEmoji('security_StorM', '🛡️');
        const emojiMemberId = getEmoji('member_storm', '👤');
        const emojiClaimId = getEmoji('security_StorM', '👑');
        const emojiCheckId = getEmoji('1check_Taxados', '✅');
        const emojiTrashId = getEmoji('notify_StorM', '🗑️');

        const emojiBellText = getEmojiText('notify_StorM', '🔔');
        const emojiClaimText = getEmojiText('security_StorM', '👑');
        const emojiMemberText = getEmojiText('member_storm', '👤');
        const emojiCheckText = getEmojiText('1check_Taxados', '✅');
        const emojiErrorText = getEmojiText('notify_StorM', '❌');
        const emojiConfigText = getEmojiText('security_StorM', '⚙️');
        const emojiWriteText = getEmojiText('notify_StorM', '📝');

        // Helper V2 robusto ANTI-TIMEOUT
        const replyV2 = async (int, { title, content, color, ephemeral = true, components = [] }) => {
            const finalComponents = [...components];

            if (title || content) {
                const container = new ContainerBuilder().setAccentColor(color || 0x2B2D31);
                if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**⚡ [SYSTEM]**\n${title}`));
                if (content) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
                finalComponents.unshift(container);
            }

            const payload = {
                flags: ephemeral ? (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2) : MessageFlags.IsComponentsV2,
                components: finalComponents
            };

            try {
                if (int.deferred) await int.editReply(payload);
                else if (!int.replied) await int.reply(payload);
            } catch (e) {
                console.error("ReplyV2 Error:", e);
                if (!int.replied) await int.reply({ content: content || title || "Erro ao processar.", ephemeral: true }).catch(() => { });
            }
        };

        const handleAiResponse = async (int, response) => {
            const session = aiSessions.get(int.user.id);

            // CASE 1: IA PERGUNTA
            if (response.type === 'question') {
                // Show Question + Button to Answer
                const container = new ContainerBuilder().setAccentColor(0xFEE75C) // Yellow
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`🤖 **A IA precisa de detalhes**`),
                        new TextDisplayBuilder().setContent(`"${response.content}"`)
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ai_answer_btn').setLabel('Responder Pergunta').setStyle(ButtonStyle.Primary).setEmoji('🗣️'),
                    new ButtonBuilder().setCustomId('ai_cancel_gen').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
                );

                // Update session
                session.lastQuestion = response.content;

                // If it's a follow-up, we use followUp or editReply? 
                // Always editReply if deferred/replied.
                // We use the same payload
                await int.editReply({
                    content: '',
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                    components: [container, row]
                });
            }

            // CASE 2: BLUEPRINT OK
            if (response.type === 'blueprint') {
                session.blueprint = response; // Store blueprint

                const stats = `📂 Categorias: **${response.categories?.length || 0}**\nChannels: **${response.categories?.reduce((acc, c) => acc + c.channels.length, 0) || 0}**\nRoles: **${response.roles?.length || 0}**`;
                const preview = response.categories?.slice(0, 3).map(c => `• **${c.name}** (${c.channels.length} canais)`).join('\n') + '\n...';

                const container = new ContainerBuilder().setAccentColor(0x5865F2) // Blurple
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`🤖 **Plano do Servidor: ${response.theme_name}**`),
                        new TextDisplayBuilder().setContent(`${response.explanation || 'Estrutura gerada com sucesso.'}\n\n${stats}`),
                        new TextDisplayBuilder().setContent(`**Preview:**\n${preview}`)
                    );

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ai_confirm_blueprint').setLabel('APROVAR E DESTRUIR TUDO').setStyle(ButtonStyle.Danger).setEmoji('☢️'),
                    new ButtonBuilder().setCustomId('ai_regenerate').setLabel('Gerar Outro').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
                    new ButtonBuilder().setCustomId('ai_cancel_gen').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                );

                await int.editReply({
                    content: '',
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                    components: [container, row]
                });
            }
        };

        try {
            // =========================================================================
            //                         COMMAND HANDLERS
            // =========================================================================

            if (interaction.isChatInputCommand()) {
                // --- COMANDO /BOTCONFIG ---
                if (interaction.commandName === 'botconfig') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const currentData = db.getGuild(interaction.guild.id);
                    const roleAuto = currentData.auto_role_id ? `<@&${currentData.auto_role_id}>` : '`Não Configurado`';
                    const roleStaff = currentData.staff_role_id ? `<@&${currentData.staff_role_id}>` : '`Não Configurado`';
                    const logsChannel = currentData.logs_channel_id ? `<#${currentData.logs_channel_id}>` : '`Não Configurado`';
                    const welcomeChannel = currentData.welcome_channel_id ? `<#${currentData.welcome_channel_id}>` : '`Não Configurado`';

                    const container = new ContainerBuilder().setAccentColor(0x5865F2)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${emojiConfigText} | **Painel de Configuração**`),
                            new TextDisplayBuilder().setContent(`Gerencie as configurações do bot aqui.\n\n**Auto Role**: ${roleAuto}\n**Cargo Staff**: ${roleStaff}\n**Canal Logs**: ${logsChannel}\n**Canal Boas-vindas**: ${welcomeChannel}`)
                        );

                    const menu = new StringSelectMenuBuilder().setCustomId('config_menu_select').setPlaceholder('Alterar Configuração...')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('Definir Auto Role').setValue('set_autorole').setDescription('Cargo dado ao entrar.').setEmoji(emojiMemberId),
                            new StringSelectMenuOptionBuilder().setLabel('Definir Cargo Staff').setValue('set_staffrole').setDescription('Cargo que gerencia tickets.').setEmoji(emojiSecurityId),
                            new StringSelectMenuOptionBuilder().setLabel('Definir Canal Logs').setValue('set_logschannel').setDescription('Canal de transcripts.').setEmoji(emojiBellId),
                            new StringSelectMenuOptionBuilder().setLabel('Definir Canal Vendas').setValue('set_saleschannel').setDescription('Onde ficam os comprovantes.').setEmoji('💰'),
                            new StringSelectMenuOptionBuilder().setLabel('Definir Canal Boas-vindas').setValue('set_welcomechannel').setDescription('Onde avisar novos membros.').setEmoji('👋'),
                            new StringSelectMenuOptionBuilder().setLabel('Definir Canal Resultados').setValue('set_resultschannel').setEmoji('📊'),
                            new StringSelectMenuOptionBuilder().setLabel('Editar Mensagem Boas-vindas').setValue('edit_welcome').setEmoji('📝'),
                            new StringSelectMenuOptionBuilder().setLabel('Enviar Painel Ticket').setValue('send_ticket_panel').setDescription('Enviar painel neste canal.').setEmoji(emojiBellId)
                        );

                    await interaction.editReply({
                        flags: MessageFlags.IsComponentsV2,
                        components: [container, new ActionRowBuilder().addComponents(menu)]
                    });
                    return;
                }

                // --- COMANDO /EMBED ---
                if (interaction.commandName === 'embed') {
                    // Show Modal directly (Cannot defer before modal)
                    const modal = new ModalBuilder().setCustomId('modal_embed_create').setTitle('Criar Mensagem V2');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_content').setLabel('Conteúdo (Markdown)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_color').setLabel('Cor Hex (Ex: #FF0000)').setStyle(TextInputStyle.Short).setRequired(false).setValue('#2B2D31'))
                    );
                    await interaction.showModal(modal);
                    return;
                }
                // --- COMANDO /REGISTRAR ---
                if (interaction.commandName === 'registrar') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const config = db.getGuild(interaction.guild.id);
                    const staffRoleId = config.staff_role_id;

                    // 1. Verificar Permissão (Staff Role)
                    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
                        /* 
                           NOTA: Se o usuário for ADM, ele deveria passar? 
                           Geralmente ADM > Staff, mas vamos seguir a regra estrita do cargo ou permissão de ADM.
                        */
                        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await replyV2(interaction, {
                                title: 'Sem Permissão',
                                content: `${emojiErrorText} Apenas membros da equipe (**<@&${staffRoleId}>**) podem registrar vendas!`,
                                color: 0xED4245
                            });
                            return;
                        }
                    }

                    const cliente = interaction.options.getUser('cliente');
                    const produto = interaction.options.getString('produto');
                    const duracao = interaction.options.getString('duracao');
                    const valor = interaction.options.getString('valor');

                    const attachment = interaction.options.getAttachment('comprovante');
                    const urlProof = interaction.options.getString('link_comprovante');

                    // Prioriza anexo, depois link
                    let finalProof = null;
                    if (attachment) finalProof = attachment.url;
                    else if (urlProof) finalProof = urlProof;

                    if (!finalProof) {
                        await replyV2(interaction, {
                            title: 'Erro no Comprovante',
                            content: `${emojiErrorText} Você precisa anexar uma **Imagem** ou fornecer um **Link** válido!`,
                            color: 0xED4245
                        });
                        return;
                    }


                    const salesChannelId = config.sales_channel_id;
                    if (!salesChannelId) {
                        await replyV2(interaction, {
                            title: 'Erro de Configuração',
                            content: `${emojiErrorText} O **Canal de Vendas** não foi definido!\nUse \`/botconfig\` para configurar.`,
                            color: 0xED4245
                        });
                        return;
                    }

                    // 2. Enviar Log
                    try {
                        const salesChannel = await interaction.guild.channels.fetch(salesChannelId);

                        const logContainer = new ContainerBuilder().setAccentColor(0x57F287)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${emojiSecurityId} | **Nova Venda Registrada**`),
                                new TextDisplayBuilder().setContent(`👤 **Cliente:** ${cliente.toString()}\n📦 **Produto:** ${produto} (${duracao})\n💰 **Valor:** R$ ${valor}\n👮 **Vendedor:** ${interaction.user.toString()}`)
                            );

                        // Envia container + arquivo (se for url, o discord embeda, se for arquivo, melhor)
                        // Para garantir que a imagem apareça legal, vamos mandar como conteudo SE for link,
                        // Se for attachment URL do proprio discord, ele expira se nao for re-upado? 
                        // Sim, attachment urls sao temporarias se a msg original sumir (mas aqui é comando slash, o attachment é temp).
                        // O ideal é enviar como 'files'.

                        const msgPayload = {
                            flags: MessageFlags.IsComponentsV2,
                            components: [logContainer]
                        };

                        // Se veio de attachment, mandamos como arquivo novo pra não expirar
                        if (attachment) {
                            msgPayload.files = [{ attachment: attachment.url, name: 'comprovante.png' }];
                        } else {
                            // Se é link externo, põe no content pra embedar
                            msgPayload.content = finalProof;
                        }

                        await salesChannel.send(msgPayload);

                    } catch (e) {
                        console.error("Erro ao enviar log sales:", e);
                        await replyV2(interaction, {
                            title: 'Erro no Envio',
                            content: `${emojiErrorText} Não consegui enviar no canal <#${salesChannelId}>.\nVerifique se o bot tem permissão de **Ver Canal** e **Enviar Mensagens** lá.`,
                            color: 0xED4245
                        });
                        return;
                    }

                    // 3. Salvar no Banco (Perfil)
                    const currentDb = db.get();
                    if (!currentDb.users) currentDb.users = {};
                    if (!currentDb.users[cliente.id]) currentDb.users[cliente.id] = { products: [] };

                    const purchaseDate = new Date().toLocaleDateString('pt-BR');
                    currentDb.users[cliente.id].products.push({
                        name: produto,
                        duration: duracao,
                        date: purchaseDate
                    });

                    db.set('users', currentDb.users);

                    db.set('users', currentDb.users);

                    // 4. Automação Pós-Venda (Pedido do User)
                    try {
                        const member = await interaction.guild.members.fetch(cliente.id);
                        await member.roles.add('1457934585257001143'); // Client Role
                    } catch (e) {
                        console.error("Erro ao dar cargo:", e);
                        // Não trava o fluxo, só avisa no console
                    }

                    await replyV2(interaction, {
                        content: `${emojiCheckText} **Venda Registrada!**\nO cliente ${cliente.toString()} recebeu o cargo e foi registrado.\n\n` +
                            `👉 **Próximos Passos para o Cliente:**\n` +
                            `Faça tudo que está explicando na mensagem deste link:\n` +
                            `https://discord.com/channels/1457865839956070452/1464483785985884252/1464660830569103562\n\n` +
                            `**Depois avise aqui!**`,
                        color: 0x57F287
                    });
                    return;
                }

                // --- COMANDO /GERARPIX (MISTIC PAY) ---
                if (interaction.commandName === 'gerarpix') {
                    await interaction.deferReply();

                    const produto = interaction.options.getString('produto');
                    const valorInput = interaction.options.getString('valor');
                    const clienteUser = interaction.options.getUser('cliente');

                    // Validation & Flexible Parsing (Comma or Dot)
                    const valor = parseFloat(valorInput.replace(',', '.'));
                    if (isNaN(valor)) {
                        await interaction.editReply({ content: '❌ Valor inválido. Use números, pontos ou vírgulas.' });
                        return;
                    }

                    // Dummy CPF Generator (11 Digits)
                    const cpf = Math.floor(10000000000 + Math.random() * 90000000000).toString().substring(0, 11);

                    try {
                        const mistic = require('../mistic');
                        const txRef = `pix-${interaction.id.slice(0, 8)}`;
                        const transaction = await mistic.createTransaction(valor, clienteUser.username, cpf, `Venda: ${produto}`, txRef);

                        // Decode QR Code
                        const buffer = Buffer.from(transaction.qrCodeBase64.split(',')[1], 'base64');

                        // Media Gallery (QR Code Inside)
                        const mediaGallery = new MediaGalleryBuilder()
                            .addItems(
                                new MediaGalleryItemBuilder().setURL('attachment://pix_qrcode.png')
                            );

                        // Embed Simplificado V2 (All Content In Container)
                        const container = new ContainerBuilder().setAccentColor(0x5865F2)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${emojiSecurityId} | **Pagamento Gerado**`),
                                new TextDisplayBuilder().setContent(`👤 ${clienteUser.toString()}\n📦 ${produto}\n💰 R$ ${valor.toFixed(2)}\n\n⏳ **Aguardando Pagamento...**`)
                            )
                            .addMediaGalleryComponents(mediaGallery) // QR CODE HERE
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**Pix Copia e Cola:**\n\`\`\`${transaction.copyPaste}\`\`\``)
                            );

                        const payload = {
                            // Content removido 100% para evitar erro V2
                            flags: MessageFlags.IsComponentsV2,
                            components: [container],
                            files: [new AttachmentBuilder(buffer, { name: 'pix_qrcode.png' })]
                        };

                        await interaction.editReply(payload);

                        // FollowUp REMOVED (Integrated inside)

                        // --- POLLING LOOP ---
                        const txId = transaction.transactionId;
                        const pollInterval = setInterval(async () => {
                            try {
                                const statusData = await mistic.checkTransaction(txId);
                                if (statusData && statusData.transactionState === 'COMPLETO') {
                                    clearInterval(pollInterval);

                                    // 1. Give Role (Dynamic)
                                    try {
                                        const config = db.getGuild(interaction.guild.id);
                                        if (config.client_role_id) {
                                            const member = await interaction.guild.members.fetch(clienteUser.id);
                                            await member.roles.add(config.client_role_id);
                                        } else {
                                            console.warn("Client Role ID not configured for this guild.");
                                        }
                                    } catch (e) { console.error('Role Error:', e); }

                                    // 2. Success Reply V2
                                    const successContainer = new ContainerBuilder()
                                        .setAccentColor(0x512DA8)
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder().setContent(`✅ **PAGAMENTO CONFIRMADO!**\n\n` +
                                                `Olá ${clienteUser.toString()}, seu pagamento foi processado com sucesso.\n\n` +
                                                `🚀 **PRÓXIMO PASSO:**\n` +
                                                `Escreva aqui abaixo: **Qual o seu Processador e sua Placa de Vídeo?**\n` +
                                                `*(Ex: i5 10400 e rtx 3060)*`),
                                            new TextDisplayBuilder().setContent(`🔊 **Aguardando Suporte:** Entre na call de suporte enquanto a IA identifica seu PC.`)
                                        );

                                    await interaction.editReply({
                                        flags: MessageFlags.IsComponentsV2,
                                        components: [successContainer],
                                        files: []
                                    });

                                    // --- AI CONFIG COLLECTOR (PHASE 20) ---
                                    const filter = m => m.author.id === clienteUser.id;
                                    const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 300000 });

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

                                    // 4. Rename Ticket
                                    if (interaction.channel.name.startsWith('ticket-')) {
                                        try {
                                            const ntName = `aguardando-otimizacao-${produto.toLowerCase().replace(/ /g, '-')}`;
                                            console.log(`[DEBUG] Renomeando ticket para ${ntName}`);
                                            await interaction.channel.setName(ntName);
                                        } catch (e) { console.error("Erro ao renomear ticket:", e); }
                                    }
                                }
                            } catch (err) { console.error('Polling Error:', err); }
                        }, 10000); // 10s

                        setTimeout(() => clearInterval(pollInterval), 900000); // 15m stop

                    } catch (e) {
                        console.error("Mistic Error:", e);
                        // Standard ephemeral error (V1 compatible if using content)
                        // If interaction deferred, we edits. remove flags if possible or just send content.
                        // editReply preserves flags? If so, we might error if we send content.
                        // Safe bet: Edit with V2 container for error or try plain content. 
                        // Let's try plain content, usually works unless strictly locked to V2.
                        await interaction.editReply({ content: `❌ Erro MisticPay: ${e.message}`, components: [], flags: 0 }).catch(() => { });
                    }
                    return;
                }

                if (interaction.commandName === 'editarembed') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const channels = await interaction.guild.channels.fetch();
                    const textChannels = channels.filter(c => c.type === ChannelType.GuildText);

                    if (textChannels.size === 0) {
                        await interaction.editReply({ content: '❌ Nenhum canal de texto encontrado.' });
                        return;
                    }

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('select_embed_edit')
                        .setPlaceholder('Escolha um canal para editar a mensagem...');

                    textChannels.forEach(c => {
                        select.addOptions(new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(`${c.id}|main_embed`));
                    });

                    await interaction.editReply({
                        content: 'Selecione o canal onde está a mensagem que deseja editar:',
                        components: [new ActionRowBuilder().addComponents(select)]
                    });
                    return;
                }

                if (interaction.commandName === 'criarserver') {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        await interaction.reply({ content: `${emojiErrorText} Sem permissão.`, ephemeral: true });
                        return;
                    }

                    // DEFER IMMEDIATELY to avoid timeout
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => { });

                    const theme = interaction.options.getString('tema');
                    const useEmojis = interaction.options.getBoolean('usar_emojis');
                    const separator = interaction.options.getString('divisoria');

                    // Init Session
                    aiSessions.set(interaction.user.id, {
                        userId: interaction.user.id,
                        theme: theme,
                        history: [],
                        config: { useEmojis, separator }
                    });


                    // Call AI Initial
                    try {
                        const response = await generateServerStructure(theme, 'analysis', []);

                        // Handle AI Response
                        if (response.type === 'question') {
                            // AI is asking for clarification
                            const modal = new ModalBuilder().setCustomId('ai_answer_question').setTitle('Responda à IA');
                            modal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('answer').setLabel(response.content).setStyle(TextInputStyle.Paragraph).setRequired(true))
                            );
                            await interaction.showModal(modal);
                        } else if (response.type === 'blueprint') {
                            // AI has generated a blueprint
                            const session = aiSessions.get(interaction.user.id);
                            session.blueprint = response;
                            aiSessions.set(interaction.user.id, session);

                            // Show blueprint preview
                            let preview = `**🎨 ${response.theme_name}**\n\n${response.explanation}\n\n**📋 Estrutura do Servidor**\n`;
                            response.categories.forEach(cat => {
                                preview += `\n${cat.name}\n`;
                                cat.channels.forEach(ch => {
                                    const emoji = ch.type === 'GUILD_VOICE' ? '🔊' : '💬';
                                    preview += `  ${emoji} ${ch.name}\n`;
                                });
                            });

                            const confirmBtn = new ButtonBuilder().setCustomId('ai_confirm_blueprint').setLabel('Confirmar').setStyle(ButtonStyle.Success);
                            const cancelBtn = new ButtonBuilder().setCustomId('ai_cancel_blueprint').setLabel('Cancelar').setStyle(ButtonStyle.Danger);
                            const regenBtn = new ButtonBuilder().setCustomId('ai_regenerate_blueprint').setLabel('Regenerar').setStyle(ButtonStyle.Secondary);
                            const btnRow = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn, regenBtn);

                            const container = new ContainerBuilder().setAccentColor(0x5865F2)
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(preview));
                            await interaction.editReply({ components: [container, btnRow], flags: MessageFlags.IsComponentsV2 });
                        }
                    } catch (e) {
                        await interaction.editReply({ content: `❌ Erro na IA: ${e.message}` });
                    }
                    return;
                }

                // --- COMANDO /POSTAR_RESULTADO (REFACTORED V15) ---
                if (interaction.commandName === 'postar_resultado') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const config = db.getGuild(interaction.guild.id);
                    const staffRoleId = config.staff_role_id;

                    // 1. Verificar Permissão
                    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
                        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await replyV2(interaction, {
                                title: 'Sem Permissão',
                                content: `${emojiErrorText} Apenas membros da equipe podem postar resultados!`,
                                color: 0xED4245
                            });
                            return;
                        }
                    }

                    const cliente = interaction.options.getUser('cliente');
                    const imagemDepois = interaction.options.getAttachment('depois_print');

                    // 2. Buscar Dados Salvos (Preenchidos pelo Cliente)
                    const feedback = config[`feedback_${cliente.id}`];
                    if (!feedback) {
                        await interaction.editReply({
                            content: `${emojiErrorText} O cliente **${cliente.username}** ainda não preencheu os detalhes do PC.\n` +
                                `Peça para ele clicar no botão **"Preencher Detalhes"** na mensagem de confirmação de pagamento!`
                        });
                        return;
                    }

                    // 3. Tentar achar a foto de ANTES no canal
                    const messages = await interaction.channel.messages.fetch({ limit: 100 });
                    const clientMsgWithImage = messages.find(m => m.author.id === cliente.id && m.attachments.size > 0);

                    if (!clientMsgWithImage) {
                        await interaction.editReply({
                            content: `${emojiErrorText} Não encontrei nenhuma print enviada pelo cliente neste canal.\n` +
                                `O cliente precisa enviar a print de **ANTES** aqui no ticket primeiro!`
                        });
                        return;
                    }

                    const imagemAntes = clientMsgWithImage.attachments.first().url;

                    // 4. Postar Resultado (Direct)
                    const resultsChannelId = config.results_channel_id;
                    if (!resultsChannelId) {
                        await interaction.editReply({ content: '❌ Canal de resultados não configurado!' });
                        return;
                    }

                    try {
                        const resultsChannel = await interaction.guild.channels.fetch(resultsChannelId);

                        const container = new ContainerBuilder()
                            .setAccentColor(0x512DA8) // Premium Purple
                            .setThumbnailAccessory(new AttachmentBuilder(cliente.displayAvatarURL({ extension: 'png', size: 256 })))
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`# 🚀 Resultado de Performance`),
                                new TextDisplayBuilder().setContent(
                                    `👤 **Cliente**: ${cliente.tag}\n` +
                                    `💻 **Setup**: \`${feedback.config}\`\n\n` +
                                    `**“ ${feedback.recado} ”**`
                                ),
                                new TextDisplayBuilder().setContent(`⚡ **Ganho de Performance**: \`${feedback.fpsGain}\``)
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
                                new AttachmentBuilder(imagemDepois.url, { name: 'depois.png' })
                            ]
                        });

                        await interaction.editReply({ content: `✅ Resultado postado com sucesso em <#${resultsChannelId}>!` });

                    } catch (e) {
                        console.error("Erro ao postar resultado (Refactored):", e);
                        await interaction.editReply({ content: '❌ Erro ao enviar para o canal de resultados.' });
                    }
                    return;
                }


                // --- COMANDO /APROVARPAGAMENTO (REMOVED - MOVED TO PREFIX +aprovar) ---
            }

            // =========================================================================
            //                     CONTEXT MENU COMMANDS (Apps)
            // =========================================================================

            if (interaction.isMessageContextMenuCommand()) {
                if (interaction.commandName === 'Postar Resultado') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    // 1. Verificar Permissão
                    const guildConfig = db.getGuild(interaction.guild.id);
                    const staffRoleId = guildConfig.staff_role_id;

                    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
                        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                            await interaction.editReply({ content: '❌ Apenas membros da equipe podem postar resultados!' });
                            return;
                        }
                    }

                    const targetMessage = interaction.targetMessage;
                    const cliente = targetMessage.author;
                    const recado = targetMessage.content;

                    // --- SMART SCRAPER (V18) ---
                    const history = await interaction.channel.messages.fetch({ limit: 100 });

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

                    // Fallback: Se não achou por palavra, pega o mais recente
                    if (!imagemAntes) {
                        const clientMsg = history.find(m => m.author.id === cliente.id && m.attachments.size > 0);
                        imagemAntes = clientMsg ? clientMsg.attachments.first().url : null;
                    }
                    if (!imagemDepois) {
                        const staffMsg = history.find(m => m.author.id === interaction.user.id && m.attachments.size > 0);
                        imagemDepois = staffMsg ? staffMsg.attachments.first().url : null;
                    }

                    if (!imagemAntes || !imagemDepois) {
                        await interaction.editReply({
                            content: `❌ **Prints não identificadas!** Certifique-se de que enviou as prints com as palavras "antes" e "depois" no chat.`
                        });
                        return;
                    }

                    // 2. Sniffer de Configuração (PC Specs)
                    let pcConfig = null;
                    const hardwareKeywords = ['intel', 'amd', 'ryzen', 'core', 'i3', 'i5', 'i7', 'i9', 'rtx', 'gtx', 'radeon', 'gb', 'ram', 'nvme', 'ssd', 'xeon', 'rx', 'ti', 'super'];

                    const clientMessages = history.filter(m => m.author.id === cliente.id && !m.author.bot);
                    for (const m of clientMessages.values()) {
                        const content = m.content.toLowerCase();
                        const matchCount = hardwareKeywords.filter(kw => content.includes(kw)).length;
                        if (matchCount >= 2) {
                            pcConfig = m.content;
                            break;
                        }
                    }

                    if (!pcConfig) {
                        const dbFeedback = guildConfig[`feedback_${cliente.id}`];
                        pcConfig = dbFeedback ? dbFeedback.config : 'PC não informado (Staff check)';
                    }

                    // 3. Postar Instantaneamente
                    const resultsChannelId = guildConfig.results_channel_id;
                    if (!resultsChannelId) {
                        await interaction.editReply({ content: '❌ Canal de resultados não configurado!' });
                        return;
                    }

                    try {
                        const resultsChannel = await interaction.guild.channels.fetch(resultsChannelId);

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

                        try {
                            await interaction.editReply({ content: `✅ **Resultado postado com sucesso em <#${resultsChannelId}>!** Inteligência artificial identificou os dados corretamente.` });
                        } catch (innerError) {
                            console.error("Erro no editReply de sucesso:", innerError);
                        }

                    } catch (e) {
                        console.error("Erro no Context Menu Smart-Post:", e);
                        await interaction.editReply({ content: '❌ Erro ao enviar resultado. Verifique as prints e o canal.' });
                    }
                }
            }

            if (interaction.isModalSubmit()) {
                // --- CLIENT FEEDBACK MODAL (V15) ---
                if (interaction.customId === 'modal_client_details') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const config = interaction.fields.getTextInputValue('cl_config');
                    const fpsGain = interaction.fields.getTextInputValue('cl_fps');
                    const recado = interaction.fields.getTextInputValue('cl_recado');

                    // Save to DB (Persistent)
                    db.setGuild(interaction.guild.id, `feedback_${interaction.user.id}`, {
                        config,
                        fpsGain,
                        recado,
                        timestamp: Date.now()
                    });

                    await interaction.editReply({ content: '✅ **Detalhes salvos com sucesso!**\nA equipe usará essas informações para postar seu resultado em breve. Obrigado!' });
                    return;
                }
                // --- EMBED CONTROLLER (DIRECT SEND) ---
                if (interaction.customId === 'modal_embed_create') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const title = interaction.fields.getTextInputValue('input_title');
                    const content = interaction.fields.getTextInputValue('input_content');
                    const colorInput = interaction.fields.getTextInputValue('input_color').replace('#', '');
                    const color = parseInt(colorInput, 16) || 0x2B2D31;

                    // 1. Build & Send IMMEDIATELY
                    const container = new ContainerBuilder().setAccentColor(color);
                    if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`));
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

                    const sentMsg = await interaction.channel.send({
                        flags: MessageFlags.IsComponentsV2,
                        components: [container]
                    });

                    // 2. Store Context (User -> Active Message)
                    embedDrafts.set(interaction.user.id, {
                        msgId: sentMsg.id,
                        channelId: sentMsg.channelId,
                        color: color,
                        title: title,
                        content: content,
                        buttons: [] // Initialize buttons array
                    });

                    // 3. Ephemeral Controls
                    const controlRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('embed_add_btn_to_msg').setLabel('Adicionar Botão').setStyle(ButtonStyle.Secondary).setEmoji(emojiWriteText),
                        new ButtonBuilder().setCustomId('embed_delete_msg').setLabel('Deletar Mensagem').setStyle(ButtonStyle.Danger).setEmoji(emojiTrashId)
                    );

                    await interaction.editReply({
                        content: `${emojiCheckText} **Embed Enviado!**\nUse os botões abaixo para editar a mensagem enviada acima.`,
                        components: [controlRow]
                    });
                    return;
                }

                if (interaction.customId === 'modal_embed_add_url') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const label = interaction.fields.getTextInputValue('btn_label');
                    const url = interaction.fields.getTextInputValue('btn_url');

                    const draft = embedDrafts.get(interaction.user.id);
                    if (!draft) {
                        await interaction.editReply({ content: '❌ Sessão expirada ou mensagem perdida.' });
                        return;
                    }

                    try {
                        const msg = await interaction.channel.messages.fetch(draft.msgId);
                        if (!msg) throw new Error("Mensagem não encontrada");

                        // Rebuild Container + Actions
                        // NOTE: To edit V2, we often need to rebuild the container structure or it might reset.
                        // Let's get existing buttons if any? 
                        // Simplified: We assume we are building up.

                        const container = new ContainerBuilder().setAccentColor(draft.color);
                        if (draft.title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${draft.title}**`));
                        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(draft.content));

                        // Get existing components from the message to preserve previous buttons?
                        // For simplicity in this session: we pull from what we just added? NO, we didn't save buttons in draft.
                        // Better: Keep buttons in draft.
                        if (!draft.buttons) draft.buttons = [];
                        draft.buttons.push({ label, url });

                        const btnComponents = draft.buttons.map(b =>
                            new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.url)
                        );

                        // Add ActionRow to Container
                        container.addActionRowComponents(new ActionRowBuilder().addComponents(btnComponents));

                        await msg.edit({ components: [container] });

                        await interaction.editReply({ content: `✅ Botão **${label}** adicionado!`, components: [] });

                        // Show controls again?
                        const controlRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('embed_add_btn_to_msg').setLabel('Adicionar Outro Botão').setStyle(ButtonStyle.Secondary).setEmoji(emojiWriteText),
                            new ButtonBuilder().setCustomId('embed_delete_msg').setLabel('Deletar Mensagem').setStyle(ButtonStyle.Danger).setEmoji(emojiTrashId)
                        );
                        await interaction.followUp({ content: 'Opções:', components: [controlRow], flags: MessageFlags.Ephemeral });

                    } catch (e) {
                        console.error(e);
                        await interaction.editReply({ content: '❌ Erro ao editar a mensagem. Ela foi apagada?' });
                    }
                    return;
                }

                // --- AI ANSWER MODAL ---
                if (interaction.customId === 'ai_modal_answer') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const ans = interaction.fields.getTextInputValue('answer_text');

                    const session = aiSessions.get(interaction.user.id);
                    if (session) {
                        session.history.push({ role: 'model', parts: [{ text: session.lastQuestion || '' }] });
                        session.history.push({ role: 'user', parts: [{ text: ans }] });

                        await interaction.editReply('🤔 **Analisando sua resposta...**');

                        // Call AI Again
                        const response = await generateServerStructure(session.theme, 'analysis', session.history);
                        await handleAiResponse(interaction, response);
                    } else {
                        await interaction.editReply('Sessão perdida.');
                    }
                    return;
                }

                // --- TICKET RENAME ---
                if (interaction.customId === 'modal_rename_ticket') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const newName = interaction.fields.getTextInputValue('input_new_name');
                    await interaction.channel.setName(newName);
                    await replyV2(interaction, { title: 'Sucesso', content: `Canal renomeado para **${newName}**!`, color: 0x57F287 });
                    return;
                }
            }

            // =========================================================================
            //                         BUTTONS & MENUS
            // =========================================================================

            // SERVER GEN (AI) HANDLERS
            if (interaction.customId === 'ai_cancel_gen') {
                aiSessions.delete(interaction.user.id);
                await interaction.update({ content: '❌ Operação cancelada.', components: [] });
            }

            if (interaction.customId === 'ai_regenerate') {
                const session = aiSessions.get(interaction.user.id);
                if (!session) return interaction.reply({ content: 'Sessão expirada.', ephemeral: true });

                await interaction.update({ content: '🔄 Gerando nova versão...', components: [] });
                const response = await generateServerStructure(session.theme, 're-gen', session.history);
                await handleAiResponse(interaction, response);
            }

            if (interaction.customId === 'client_fill_details') {
                const modal = new ModalBuilder().setCustomId('modal_client_details').setTitle('Detalhes da Otimização');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cl_config').setLabel('Configuração (PC/Notebook)').setPlaceholder('Ex: i5 10400 + RTX 3060').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cl_fps').setLabel('Ganhos de FPS').setPlaceholder('Ex: +130 FPS').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cl_recado').setLabel('Seu Recado/Feedback').setPlaceholder('Ex: A otimização ficou pica, subiu muito o FPS!').setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'ai_answer_btn') {
                const modal = new ModalBuilder().setCustomId('ai_modal_answer').setTitle('Responder à IA');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('answer_text').setLabel('Sua resposta').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ));
                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('confirm_specs_ok_')) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const specs = interaction.customId.replace('confirm_specs_ok_', '');

                const config = db.getGuild(interaction.guild.id);
                config[`feedback_${interaction.user.id}`] = {
                    config: specs,
                    fps: 'Pendente (Staff check)', // Will be set by staff/result command if needed
                    recado: 'Aguardando recado final...'
                };
                db.setGuild(interaction.guild.id, `feedback_${interaction.user.id}`, config[`feedback_${interaction.user.id}`]);

                await interaction.editReply({ content: `✅ **Configuração confirmada!** Salvei como: \`${specs}\`.\nPeça para a staff postar seu resultado quando a otimização terminar!` });
                await interaction.message.delete().catch(() => { });
                return;
            }

            if (interaction.customId === 'edit_specs_retry') {
                await interaction.reply({ content: 'Sem problemas! **Escreva novamente** o seu Processador e Placa de Vídeo abaixo.', flags: MessageFlags.Ephemeral });
                // The existing collector might have expired, so we don't need to do much here, 
                // but we can spawn a new short-term collector if we wanted. 
                // Pragmatic: Just tell them to write again, the collector in payment success might have ended,
                // so we add a new one specifically for this retry.
                const filter = m => m.author.id === interaction.user.id;
                const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });
                collector.on('collect', async m => {
                    const beautified = beautify(m.content);
                    const confirmContainer = new ContainerBuilder()
                        .setAccentColor(0x5865F2)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`🤖 **IA TENTOU NOVAMENTE!**`),
                            new TextDisplayBuilder().setContent(`Identifiquei: **${beautified}**`),
                            new TextDisplayBuilder().setContent(`Está melhor agora?`)
                        );
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`confirm_specs_ok_${beautified}`).setLabel('Sim ✅').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('edit_specs_retry').setLabel('Não ✏️').setStyle(ButtonStyle.Secondary)
                    );
                    await m.reply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer, row] });
                });
                return;
            }

            if (interaction.customId === 'ai_confirm_blueprint') {
                const session = aiSessions.get(interaction.user.id);
                if (!session || !session.blueprint) return interaction.reply({ content: 'Sessão inválida.', ephemeral: true });

                const structure = session.blueprint;
                let logMessages = [];

                // Helper function to add log and update display
                const addLog = async (emoji, message) => {
                    logMessages.push(`${emoji} ${message}`);
                    const displayLogs = logMessages.slice(-6).join('\n');
                    const container = new ContainerBuilder().setAccentColor(0xFF6B6B)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏗️ **Gerando Servidor..**\n\n🔴 Começando a deletar todos os canais...\n\n**📋 Atualizações em Tempo Real**\n${displayLogs}`));
                    try {
                        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                    } catch (e) { }
                };

                await interaction.update({
                    components: [new ContainerBuilder().setAccentColor(0xFF0000)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('🏗️ **Gerando Servidor..**\n\nEstou fazendo a estrutura do servidor para você'))],
                    flags: MessageFlags.IsComponentsV2
                });

                try {
                    const guild = interaction.guild;
                    const progressChannel = interaction.channel; // Save the current channel

                    // Step 1: Delete channels (except progress channel)
                    await addLog('🔴', 'Começando a deletar todos os canais...');
                    const channels = await guild.channels.fetch();
                    for (const [, c] of channels) {
                        if (c.id === progressChannel.id) continue; // Skip progress channel
                        try {
                            await c.delete();
                            await addLog('✅', `${c.name} foi deletado com sucesso...`);
                        } catch (e) { }
                    }

                    // Step 2: Delete roles
                    await addLog('🔴', 'Deletando cargos antigos...');
                    const roles = await guild.roles.fetch();
                    for (const [, r] of roles) {
                        if (!r.managed && r.name !== '@everyone' && r.id !== guild.ownerId) {
                            try {
                                await r.delete();
                                await addLog('✅', `Cargo "${r.name}" foi deletado...`);
                            } catch (e) { }
                        }
                    }

                    await addLog('✅', 'Desabilitei os recursos de comunidade.');

                    // Step 3: Create roles
                    await addLog('🔴', 'Criando novos cargos...');
                    const roleMap = {}; // To store role IDs by name
                    if (structure.roles) {
                        for (const r of structure.roles) {
                            try {
                                const newRole = await guild.roles.create({ name: r.name, color: r.color || 'Random', reason: 'AI Gen' });
                                roleMap[r.name] = newRole.id;
                                await addLog('✅', `Cargo "${r.name}" criado!`);
                            } catch (e) { }
                        }
                    }

                    const roleNames = Object.keys(roleMap);
                    const memberRoleId = roleNames.find(name => name.toLowerCase().includes('membro'))
                        ? roleMap[roleNames.find(name => name.toLowerCase().includes('membro'))]
                        : (roleNames.find(name => name.toLowerCase().includes('cliente')) ? roleMap[roleNames.find(name => name.toLowerCase().includes('cliente'))] : null);

                    const staffRoleId = roleNames.find(name => name.toLowerCase().includes('staff') || name.toLowerCase().includes('admin') || name.toLowerCase().includes('fundador'))
                        ? roleMap[roleNames.find(name => name.toLowerCase().includes('staff') || name.toLowerCase().includes('admin') || name.toLowerCase().includes('fundador'))]
                        : null;

                    // Save Auto-Role to DB
                    if (memberRoleId) {
                        db.setGuild(guild.id, 'auto_role_id', memberRoleId);
                        await addLog('✅', 'Cargo de membro configurado como Auto-Role.');
                    }
                    if (staffRoleId) {
                        db.setGuild(guild.id, 'staff_role_id', staffRoleId);
                        await addLog('✅', 'Cargo de staff configurado como administrador do sistema.');
                    }

                    // Step 4: Create categories and channels
                    await addLog('🔴', 'Criando categorias e canais...');
                    let firstChannel = null;
                    if (structure.categories) {
                        for (const cat of structure.categories) {
                            try {
                                const newCat = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
                                await addLog('✅', `Categoria "${cat.name}" criada!`);

                                if (cat.channels && Array.isArray(cat.channels)) {
                                    for (const ch of cat.channels) {
                                        try {
                                            const type = ch.type === 'GUILD_VOICE' ? ChannelType.GuildVoice : ChannelType.GuildText;

                                            // Permission Overwrites Logic
                                            const overwrites = [];
                                            if (ch.access === 'staff') {
                                                overwrites.push({ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] });
                                                if (staffRoleId) overwrites.push({ id: staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
                                            } else if (ch.access === 'read-only') {
                                                overwrites.push({ id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.SendMessages] });
                                                if (staffRoleId) overwrites.push({ id: staffRoleId, allow: [PermissionsBitField.Flags.SendMessages] });
                                            } else {
                                                // Public
                                                overwrites.push({ id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
                                            }

                                            const newCh = await newCat.children.create({
                                                name: ch.name,
                                                type: type,
                                                topic: ch.topic || '',
                                                permissionOverwrites: overwrites
                                            });

                                            if (!firstChannel && type === ChannelType.GuildText) firstChannel = newCh;

                                            // Auto-Setup Ticket System
                                            if (ch.name.toLowerCase().includes('ticket') ||
                                                ch.name.toLowerCase().includes('suporte') ||
                                                ch.name.toLowerCase().includes('atendimento')) {

                                                db.setGuild(guild.id, 'ticket_channel_id', newCh.id);
                                                const { setupTicketSystem } = require('../setup_ticket');
                                                setupTicketSystem(interaction.client, newCh.id).then(success => {
                                                    if (success) addLog('🎫', `Sistema de Ticket instalado em ${newCh.name}!`);
                                                });
                                            }

                                            // System Rules Channel
                                            if (ch.is_rules) {
                                                try {
                                                    await guild.edit({ rulesChannel: newCh.id });
                                                    await addLog('📜', `Canal de Regras configurado!`);
                                                } catch (e) { }
                                            }

                                            // System Updates Channel
                                            if (ch.is_updates) {
                                                try {
                                                    await guild.edit({ publicUpdatesChannel: newCh.id });
                                                    await addLog('📢', `Canal de Atualizações configurado!`);
                                                } catch (e) { }
                                            }

                                            // System Safety Notifications Channel
                                            if (ch.is_safety) {
                                                try {
                                                    await guild.edit({ safetyNotificationsChannel: newCh.id });
                                                    await addLog('🛡️', `Canal de Segurança configurado!`);
                                                } catch (e) { }
                                            }

                                            await addLog('✅', `Canal "${ch.name}" criado!`);
                                        } catch (e) {
                                            console.error(`Erro ao criar canal ${ch.name}:`, e);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error(`Erro ao criar categoria ${cat.name}:`, e);
                            }
                        }
                    }

                    // Step 5: Deploy Initial V2 Content
                    if (structure.initial_content && Array.isArray(structure.initial_content)) {
                        await addLog('📝', 'Gerando conteúdo inteligente nos canais...');
                        const channels = await guild.channels.fetch();

                        for (const item of structure.initial_content) {
                            // Find matching channel by keyword
                            const channel = channels.find(c => c.name.includes(item.channel_keyword) && c.type === ChannelType.GuildText);
                            if (channel) {
                                try {
                                    const embedData = item.content;
                                    const container = new ContainerBuilder()
                                        .setAccentColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0x5865F2);

                                    const textComponents = [];
                                    if (embedData.title) textComponents.push(new TextDisplayBuilder().setContent(`# ${embedData.title}`));
                                    if (embedData.description) textComponents.push(new TextDisplayBuilder().setContent(embedData.description));
                                    if (embedData.footer) textComponents.push(new TextDisplayBuilder().setContent(`*${embedData.footer}*`));

                                    container.addTextDisplayComponents(...textComponents);

                                    await channel.send({
                                        flags: MessageFlags.IsComponentsV2,
                                        components: [container]
                                    });

                                    // Save to DB for future editing
                                    // db.setEmbed(guild.id, item.embed_id, embedData); // TODO: Implement db.setEmbed
                                    await addLog('✨', `Conteúdo gerado em ${channel.name}`);
                                } catch (err) {
                                    console.error(`Erro ao enviar conteúdo para ${channel.name}:`, err);
                                }
                            }
                        }
                    }

                    await addLog('✅', 'Configurando permissões apropriadas...');

                    try {
                        await guild.edit({
                            description: structure.description || `Servidor Profissional de ${structure.theme_name}`,
                            preferredLocale: 'pt-BR'
                        });
                        await addLog('🌎', 'Configs de Linguagem e Descrição aplicadas!');
                    } catch (e) { }

                    await addLog('✅', 'Finalizando servidor...');

                    // Final success message with buttons
                    const deleteBtn = new ButtonBuilder().setCustomId('delete_progress_channel').setLabel('Deletar Este Canal').setStyle(ButtonStyle.Danger);
                    const configWelcomeBtn = new ButtonBuilder().setCustomId('config_welcome_msg').setLabel('Configurar Boas-Vindas').setStyle(ButtonStyle.Primary);
                    const btnRow = new ActionRowBuilder().addComponents(deleteBtn, configWelcomeBtn);

                    const finalContainer = new ContainerBuilder().setAccentColor(0x57F287)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **${structure.theme_name} Criado!**\n\nSeu servidor foi gerado com sucesso!\nTodos os canais, cargos e permissões foram configurados.`));
                    await interaction.editReply({ components: [finalContainer, btnRow], flags: MessageFlags.IsComponentsV2 });

                    if (firstChannel) {
                        const welcomeContainer = new ContainerBuilder().setAccentColor(0x5865F2)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🎉 Bem-vindo ao **${structure.theme_name}**!\n\n${structure.explanation || 'Seu servidor foi criado pela IA!'}`));
                        await firstChannel.send({ components: [welcomeContainer], flags: MessageFlags.IsComponentsV2 });
                    }


                } catch (e) {
                    console.error(e);
                    try { await interaction.followUp({ content: `❌ Erro fatal durante a construção: ${e.message}`, ephemeral: true }); } catch (ex) { }
                }
                aiSessions.delete(interaction.user.id);
            }

            // --- DELETE PROGRESS CHANNEL ---
            if (interaction.customId === 'delete_progress_channel') {
                try {
                    await interaction.channel.delete();
                } catch (e) {
                    await interaction.reply({ content: '❌ Não consegui deletar este canal.', ephemeral: true });
                }
            }

            // --- CONFIGURE WELCOME MESSAGE ---
            if (interaction.customId === 'config_welcome_msg') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                // Create a draft welcome embed
                const currentConfig = db.getGuild(interaction.guild.id);
                const savedWelcome = currentConfig.welcome_message;

                const welcomeDraft = savedWelcome || {
                    content: '{user_mention}', // Mention outside handling
                    embed: {
                        title: 'Bem-vindo(a)!',
                        description: 'Olá {user_mention}, seja muito bem-vindo(a) à **{server_name}**!\n\nNão esqueça de ler as regras e divirta-se! :)',
                        color: '#5865F2',
                        author: { name: '{user_tag}', iconURL: '{user_avatar}' },
                        footer: { text: '{server_name}', iconURL: '{server_icon}' },
                        thumbnail: '{user_avatar}', // User avatar default
                        image: 'https://raw.githubusercontent.com/simo665/SFD-Assets/refs/heads/main/images/gifs/line2.gif'
                    },
                    isWelcome: true
                };

                embedDrafts.set(interaction.user.id, welcomeDraft);

                // Show the embed editor
                const editButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('welcome_edit_content').setLabel('Editar Conteúdo').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('welcome_edit_basics').setLabel('Editar Básicos').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('welcome_edit_author').setLabel('Editar Autor').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('welcome_edit_footer').setLabel('Editar Rodapé').setStyle(ButtonStyle.Secondary)
                );

                const imageButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('welcome_edit_images').setLabel('Editar Imagens').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('welcome_test_embed').setLabel('Testar Embed').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('welcome_show_variables').setLabel('Mostrar Variáveis').setStyle(ButtonStyle.Secondary)
                );

                const container = new ContainerBuilder().setAccentColor(0x5865F2)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('**🎉 Configurar Mensagem de Boas-Vindas**\n\nUse os botões abaixo para editar a mensagem de boas-vindas.\nClique em "Mostrar Variáveis" para ver todas as variáveis disponíveis.'));

                await interaction.editReply({ components: [container, editButtons, imageButtons], flags: MessageFlags.IsComponentsV2 });
            }

            // --- SHOW VARIABLES ---
            if (interaction.customId === 'welcome_show_variables') {
                const variablesText = `**🎯 Variáveis Disponíveis**

user_name -> Nome de usuário do membro
user_display_name -> Nome de exibição no servidor (apelido)
user_mention -> Mencionar o membro (@Usuário)
user_id -> ID único do membro
user_avatar -> URL do avatar do membro
user_is_bot -> 'Sim' se for bot, 'Não' caso contrário
account_created_date -> Data de criação (ex. 25/11/2006)
account_created_relative -> Idade relativa (ex. '19 anos atrás')
join_date_relative -> Tempo relativo de entrada (ex. '5 minutos atrás')
server_name -> Nome do servidor
server_id -> ID do servidor
server_icon -> URL do ícone do servidor
server_banner -> URL do banner do servidor
server_member_count -> Número total de membros
server_boost_count -> Número de impulsos do servidor
server_boost_tier -> Nível de impulso atual (0-3)
server_owner_id -> ID do dono do servidor
emoji_magic -> Emoji mágico
emoji_support -> Emoji de suporte
random_anime_gif -> GIF de anime aleatório
line_gif -> Separador de linha colorido`;

                const container = new ContainerBuilder().setAccentColor(0x5865F2)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(variablesText));
                await interaction.reply({ content: '📋 **Use estas variáveis ao configurar sua mensagem!**', components: [container], ephemeral: true });
            }

            // --- WELCOME EDIT BUTTONS ---
            if (interaction.customId === 'welcome_edit_content') {
                const modal = new ModalBuilder().setCustomId('modal_welcome_content').setTitle('Editar Conteúdo da Mensagem');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('content').setLabel('Conteúdo da Mensagem').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Bem-vindo {user_mention} ao {server_name}!'))
                );
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'welcome_edit_basics') {
                let draft = embedDrafts.get(interaction.user.id);
                if (!draft) {
                    const cfg = db.getGuild(interaction.guild.id);
                    draft = cfg.welcome_message || { embed: {} };
                    embedDrafts.set(interaction.user.id, draft);
                }

                const modal = new ModalBuilder().setCustomId('modal_welcome_basics').setTitle('Editar Básicos da Embed');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.title || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(draft?.embed?.description || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Cor (Hex, ex: #FF5733)').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.color || ''))
                );
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'welcome_edit_author') {
                let draft = embedDrafts.get(interaction.user.id);
                if (!draft) {
                    const cfg = db.getGuild(interaction.guild.id);
                    draft = cfg.welcome_message || { embed: { author: {} } };
                    embedDrafts.set(interaction.user.id, draft);
                }
                const modal = new ModalBuilder().setCustomId('modal_welcome_author').setTitle('Editar Autor da Embed');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_name').setLabel('Nome do Autor').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.author?.name || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('author_icon').setLabel('URL do Ícone do Autor').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.author?.iconURL || ''))
                );
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'welcome_edit_footer') {
                let draft = embedDrafts.get(interaction.user.id);
                if (!draft) {
                    const cfg = db.getGuild(interaction.guild.id);
                    draft = cfg.welcome_message || { embed: { footer: {} } };
                    embedDrafts.set(interaction.user.id, draft);
                }
                const modal = new ModalBuilder().setCustomId('modal_welcome_footer').setTitle('Editar Rodapé da Embed');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_text').setLabel('Texto do Rodapé').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.footer?.text || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer_icon').setLabel('URL do Ícone do Rodapé').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.footer?.iconURL || ''))
                );
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'welcome_edit_images') {
                let draft = embedDrafts.get(interaction.user.id);
                if (!draft) {
                    const cfg = db.getGuild(interaction.guild.id);
                    draft = cfg.welcome_message || { embed: {} };
                    embedDrafts.set(interaction.user.id, draft);
                }
                const modal = new ModalBuilder().setCustomId('modal_welcome_images').setTitle('Editar Imagens da Embed');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('URL da Miniatura').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.thumbnail || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setValue(draft?.embed?.image || ''))
                );
                await interaction.showModal(modal);
                return;
            }

            // --- TEST WELCOME EMBED ---
            if (interaction.customId === 'welcome_test_embed') {
                await interaction.deferReply({ ephemeral: true });
                const draft = embedDrafts.get(interaction.user.id);

                if (!draft) {
                    await interaction.editReply({ content: '❌ Sessão perdida. Tente novamente.' });
                    return;
                }

                // Replace variables with test data
                const replaceVars = (text) => {
                    if (!text) return text;
                    return text
                        .replace(/{user}/g, interaction.user.username)
                        .replace(/{user_mention}/g, `<@${interaction.user.id}>`)
                        .replace(/{user_tag}/g, interaction.user.tag)
                        .replace(/{user_id}/g, interaction.user.id)
                        .replace(/{server}/g, interaction.guild.name)
                        .replace(/{server_name}/g, interaction.guild.name)
                        .replace(/{member_count}/g, interaction.guild.memberCount.toString());
                };

                const embedData = draft.embed;
                const container = new ContainerBuilder()
                    .setAccentColor(embedData.color ? parseInt(embedData.color.replace('#', ''), 16) : 0x5865F2);

                const textComponents = [];
                if (embedData.title) textComponents.push(new TextDisplayBuilder().setContent(`# ${replaceVars(embedData.title)}`));
                if (embedData.description) textComponents.push(new TextDisplayBuilder().setContent(replaceVars(embedData.description)));

                if (textComponents.length > 0) container.addTextDisplayComponents(...textComponents);

                if (embedData.thumbnail) {
                    container.setThumbnailAccessory(new AttachmentBuilder(embedData.thumbnail));
                } else {
                    // Use user avatar as default similar to guildMemberAdd
                    container.setThumbnailAccessory(new AttachmentBuilder(interaction.user.displayAvatarURL({ extension: 'png', size: 256 })));
                }

                if (embedData.footer && embedData.footer.text) {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`_${replaceVars(embedData.footer.text)}_`).setColor('subtext'));
                }

                if (embedData.image) {
                    container.setImage(new AttachmentBuilder(embedData.image));
                }

                const payload = {
                    content: replaceVars(draft.content) || '',
                    flags: MessageFlags.IsComponentsV2,
                    components: [container]
                };

                try {
                    await interaction.channel.send(payload);
                    await interaction.editReply({ content: '✅ Embed (V2) de teste enviada no canal!' });
                } catch (e) {
                    console.error(e);
                    await interaction.editReply({ content: `❌ Erro ao enviar: ${e.message}` });
                }
            }



            // --- EMBED CONTROLS ---
            if (interaction.customId === 'embed_add_btn_to_msg') {
                // Modal needed
                const modal = new ModalBuilder().setCustomId('modal_embed_add_url').setTitle('Adicionar Botão Link');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_label').setLabel('Nome do Botão').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_url').setLabel('URL (Link)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                await interaction.showModal(modal);
                return;
            }
            if (interaction.customId === 'embed_delete_msg') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    try {
                        const msg = await interaction.channel.messages.fetch(draft.msgId);
                        if (msg) await msg.delete();
                        await interaction.editReply({ content: '🗑️ Mensagem deletada.', components: [] });
                    } catch (e) {
                        await interaction.editReply({ content: '❌ Mensagem já não existe.', components: [] });
                    }
                    embedDrafts.delete(interaction.user.id);
                } else {
                    await interaction.editReply({ content: '❌ Sessão perdida.', components: [] });
                }
                return;
            }

            if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isUserSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isChannelSelectMenu()) return;

            // --- CONFIG MENU ---
            if (interaction.customId === 'config_menu_select') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const selected = interaction.values[0];

                if (selected === 'set_autorole') {
                    const roleSelect = new RoleSelectMenuBuilder().setCustomId('config_save_autorole').setPlaceholder('Selecione o Cargo Auto Role').setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o cargo para dar aos novos membros:', components: [new ActionRowBuilder().addComponents(roleSelect)] });
                } else if (selected === 'set_staffrole') {
                    const roleSelect = new RoleSelectMenuBuilder().setCustomId('config_save_staffrole').setPlaceholder('Selecione o Cargo Staff').setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o cargo que terá permissão de Staff:', components: [new ActionRowBuilder().addComponents(roleSelect)] });
                } else if (selected === 'set_logschannel') {
                    const channelSelect = new ChannelSelectMenuBuilder().setCustomId('config_save_logschannel').setPlaceholder('Selecione o Canal de Logs').setChannelTypes(ChannelType.GuildText).setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o canal para enviar logs de tickets:', components: [new ActionRowBuilder().addComponents(channelSelect)] });
                } else if (selected === 'set_saleschannel') {
                    const channelSelect = new ChannelSelectMenuBuilder().setCustomId('config_save_saleschannel').setPlaceholder('Selecione o Canal de Vendas').setChannelTypes(ChannelType.GuildText).setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o canal para enviar os comprovantes:', components: [new ActionRowBuilder().addComponents(channelSelect)] });
                } else if (selected === 'set_welcomechannel') {
                    const channelSelect = new ChannelSelectMenuBuilder().setCustomId('config_save_welcomechannel').setPlaceholder('Selecione o Canal de Boas-vindas').setChannelTypes(ChannelType.GuildText).setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o canal para avisar novos membros:', components: [new ActionRowBuilder().addComponents(channelSelect)] });
                } else if (selected === 'set_resultschannel') {
                    const channelSelect = new ChannelSelectMenuBuilder().setCustomId('config_save_resultschannel').setPlaceholder('Selecione o Canal de Resultados (Antes x Depois)').setChannelTypes(ChannelType.GuildText).setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione o canal para postar os resultados de otimização:', components: [new ActionRowBuilder().addComponents(channelSelect)] });
                } else if (selected === 'edit_welcome') {
                    // Re-use the existing welcome message configuration logic
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const currentConfig = db.getGuild(interaction.guild.id);
                    const savedWelcome = currentConfig.welcome_message;

                    const welcomeDraft = savedWelcome || {
                        content: '{user_mention}',
                        embed: {
                            title: 'Bem-vindo(a)!',
                            description: 'Olá {user_mention}, seja muito bem-vindo(a) à **{server_name}**!\n\nNão esqueça de ler as regras e divirta-se! :)',
                            color: '#5865F2',
                            author: { name: '{user_tag}', iconURL: '{user_avatar}' },
                            footer: { text: '{server_name}', iconURL: '{server_icon}' },
                            thumbnail: '{user_avatar}',
                            image: 'https://raw.githubusercontent.com/simo665/SFD-Assets/refs/heads/main/images/gifs/line2.gif'
                        },
                        isWelcome: true
                    };

                    embedDrafts.set(interaction.user.id, welcomeDraft);

                    const editButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('welcome_edit_content').setLabel('Editar Conteúdo').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('welcome_edit_basics').setLabel('Editar Básicos').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('welcome_edit_author').setLabel('Editar Autor').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('welcome_edit_footer').setLabel('Editar Rodapé').setStyle(ButtonStyle.Secondary)
                    );

                    const imageButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('welcome_edit_images').setLabel('Editar Imagens').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('welcome_test_embed').setLabel('Testar Embed').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('welcome_show_variables').setLabel('Mostrar Variáveis').setStyle(ButtonStyle.Secondary)
                    );

                    const container = new ContainerBuilder().setAccentColor(0x5865F2)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('**🎉 Configurar Mensagem de Boas-Vindas**\n\nUse os botões abaixo para editar a mensagem de boas-vindas.\nClique em "Mostrar Variáveis" para ver todas as variáveis disponíveis.'));

                    await interaction.editReply({ components: [container, editButtons, imageButtons], flags: MessageFlags.IsComponentsV2 });
                } else if (selected === 'send_ticket_panel') {
                    // --- ORBYON PAY DESIGN (MATCHING SETUP_TICKET.JS) ---
                    const container = new ContainerBuilder()
                        .setAccentColor(0x512DA8) // Deep Purple for premium feel
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# ⚡ Orbyon Optimizer — Planos & Preços`),
                            new TextDisplayBuilder().setContent(`Escolha a solução ideal para o seu computador e domine seus jogos com performance máxima.\n\n` +
                                `⚪ **Otimização Básica**: R$ 20,00\n` +
                                `> Limpeza de arquivos temporários, otimização de disco e debloat essencial do Windows.\n\n` +
                                `🔵 **Turbo Economic**: R$ 55,90\n` +
                                `> Melhora de latência, otimização de registros e ajustes básicos de rede + Plano Básico.\n\n` +
                                `🟡 **Otimização Avançada**: R$ 79,90\n` +
                                `> Overclock seguro, ajustes de energia ultra e priorização de processos + Plano Turbo.\n\n` +
                                `🔴 **Pro & Streamer**: R$ 120,00\n` +
                                `> Configuração completa de OBS, áudio, rede avançada e input lag zero. Atendimento VIP.\n\n` +
                                `💻 **Plus Notebook**: R$ 89,90\n` +
                                `> Foco total em temperatura e eficiência energética para notebooks gamers.`)
                        );

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('ticket_category')
                        .setPlaceholder('Escolha o seu plano de Otimização')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('Otimização Básica').setDescription('Windows R$ 20,00').setValue('opt_basic').setEmoji('⚪'),
                            new StringSelectMenuOptionBuilder().setLabel('Otimização Turbo Economic').setDescription('Windows R$ 55,90').setValue('opt_turbo').setEmoji('🔵'),
                            new StringSelectMenuOptionBuilder().setLabel('Otimização Avançada').setDescription('Windows R$ 79,90').setValue('opt_advanced').setEmoji('🟡'),
                            new StringSelectMenuOptionBuilder().setLabel('Otimização Pro & Streamer').setDescription('Windows R$ 120,00').setValue('opt_pro').setEmoji('🔴'),
                            new StringSelectMenuOptionBuilder().setLabel('Otimização Plus para Notebook').setDescription('Windows R$ 89,90').setValue('opt_notebook').setEmoji('💻')
                        );

                    const rowLinks = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel('Site').setStyle(ButtonStyle.Link).setURL('https://google.com').setEmoji('🌐'),
                        new ButtonBuilder().setLabel('Comunidade').setStyle(ButtonStyle.Link).setURL('https://discord.gg/exemplo').setEmoji('💬'),
                        new ButtonBuilder().setLabel('Dashboard').setStyle(ButtonStyle.Link).setURL('https://google.com').setEmoji('🔗')
                    );

                    // Add everything to container logic? 
                    // V2 allows ActionRows INSIDE or attached. setup_ticket.js adds them to payload directly or container?
                    // setup_ticket.js: container.addActionRowComponents(rowDropdown, rowLinks);
                    container.addActionRowComponents(new ActionRowBuilder().addComponents(select), rowLinks);

                    await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
                    await replyV2(interaction, { content: `${emojiCheckText} Painel de **Otimização** enviado com sucesso!`, color: 0x57F287 });
                }
                return;
            }

            // --- HANDLERS (SALVAR CONFIG) ---
            if (interaction.customId === 'config_save_autorole') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const roleId = interaction.values[0];
                db.set('auto_role_id', roleId);
                await replyV2(interaction, { content: `${emojiCheckText} **Auto Role** atualizado para <@&${roleId}>!`, color: 0x57F287 });
            }
            if (interaction.customId === 'config_save_staffrole') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const roleId = interaction.values[0];
                db.set('staff_role_id', roleId);
                await replyV2(interaction, { content: `${emojiCheckText} **Cargo Staff** atualizado para <@&${roleId}>!`, color: 0x57F287 });
            }
            if (interaction.customId === 'config_save_logschannel') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const channelId = interaction.values[0];
                db.set('logs_channel_id', channelId);
                await replyV2(interaction, { content: `${emojiCheckText} **Canal de Logs** atualizado para <#${channelId}>!`, color: 0x57F287 });
            }
            if (interaction.customId === 'config_save_saleschannel') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const channelId = interaction.values[0];
                db.set('sales_channel_id', channelId);
                await replyV2(interaction, { content: `${emojiCheckText} **Canal de Vendas** atualizado para <#${channelId}>!`, color: 0x57F287 });
            }
            if (interaction.customId === 'config_save_welcomechannel') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const channelId = interaction.values[0];
                db.set('welcome_channel_id', channelId);
                await replyV2(interaction, { content: `${emojiCheckText} **Canal de Boas-vindas** atualizado para <#${channelId}>!`, color: 0x57F287 });
            }
            if (interaction.customId === 'config_save_resultschannel') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const channelId = interaction.values[0];
                db.set('results_channel_id', channelId);
                await replyV2(interaction, { content: `${emojiCheckText} **Canal de Resultados** atualizado para <#${channelId}>!`, color: 0x57F287 });
            }

            // --- WELCOME MESSAGE MODAL HANDLERS ---
            if (interaction.customId === 'modal_welcome_content') {
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    draft.content = interaction.fields.getTextInputValue('content');
                    embedDrafts.set(interaction.user.id, draft);
                    db.setGuild(interaction.guild.id, 'welcome_message', draft);
                }
                await interaction.reply({ content: '✅ Conteúdo atualizado e salvo!', ephemeral: true });
            }

            if (interaction.customId === 'modal_welcome_basics') {
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    draft.embed.title = interaction.fields.getTextInputValue('title') || null;
                    draft.embed.description = interaction.fields.getTextInputValue('description') || null;
                    draft.embed.color = interaction.fields.getTextInputValue('color') || null;
                    embedDrafts.set(interaction.user.id, draft);
                    db.setGuild(interaction.guild.id, 'welcome_message', draft);
                }
                await interaction.reply({ content: '✅ Básicos atualizados e salvos!', ephemeral: true });
            }

            if (interaction.customId === 'modal_welcome_author') {
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    draft.embed.author.name = interaction.fields.getTextInputValue('author_name') || null;
                    draft.embed.author.iconURL = interaction.fields.getTextInputValue('author_icon') || null;
                    embedDrafts.set(interaction.user.id, draft);
                    db.setGuild(interaction.guild.id, 'welcome_message', draft);
                }
                await interaction.reply({ content: '✅ Autor atualizado e salvo!', ephemeral: true });
            }

            if (interaction.customId === 'modal_welcome_footer') {
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    draft.embed.footer.text = interaction.fields.getTextInputValue('footer_text') || null;
                    draft.embed.footer.iconURL = interaction.fields.getTextInputValue('footer_icon') || null;
                    embedDrafts.set(interaction.user.id, draft);
                    db.setGuild(interaction.guild.id, 'welcome_message', draft);
                }
                await interaction.reply({ content: '✅ Rodapé atualizado e salvo!', ephemeral: true });
            }

            if (interaction.customId === 'modal_welcome_images') {
                const draft = embedDrafts.get(interaction.user.id);
                if (draft) {
                    draft.embed.thumbnail = interaction.fields.getTextInputValue('thumbnail') || null;
                    draft.embed.image = interaction.fields.getTextInputValue('image') || null;
                    embedDrafts.set(interaction.user.id, draft);
                    db.setGuild(interaction.guild.id, 'welcome_message', draft);
                }
                await interaction.reply({ content: '✅ Imagens atualizadas e salvas!', ephemeral: true });
            }



            // --- TICKET LOGIC (EXISTING) ---

            // --- 1. CRIAR TICKET ---
            if (interaction.customId === 'ticket_category') {
                console.log(`[DEBUG] Iniciando criação de ticket para ${interaction.user.tag}...`);
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const categoryValue = interaction.values[0];
                console.log(`[DEBUG] Categoria selecionada: ${categoryValue}`);

                // --- 1.1 CONFIGURAÇÕES INICIAIS ---
                const dbData = db.load() || { ticket_count: 0 };
                if (typeof dbData.ticket_count !== 'number') dbData.ticket_count = 0;
                dbData.ticket_count++;
                db.set('ticket_count', dbData.ticket_count);

                const guildConfig = db.getGuild(interaction.guild.id);
                const staffRole = guildConfig.staff_role_id;
                const ownerId = "1271280803521101824"; // Adicionado manual ou pegar da guilda

                // --- 1.2 MAPEAMENTO DE PLANOS ---
                const planMap = {
                    'opt_basic': { name: 'Otimização Básica', price: 20.00, short: 'basica' },
                    'opt_turbo': { name: 'Turbo Economic', price: 55.90, short: 'turbo' },
                    'opt_advanced': { name: 'Otimização Avançada', price: 79.90, short: 'avançada' },
                    'opt_pro': { name: 'Pro & Streamer', price: 120.00, short: 'pro' },
                    'opt_notebook': { name: 'Plus Notebook', price: 89.90, short: 'notebook' },
                    'opt_support': { name: 'Suporte / Dúvidas', price: 0, short: 'suporte' },
                    'tech_support': { name: 'Suporte Técnico', price: 0, short: 'suporte' },
                    'finance': { name: 'Financeiro', price: 0, short: 'financeiro' },
                    'general': { name: 'Dúvidas Gerais', price: 0, short: 'duvidas' },
                    'report': { name: 'Denúncia', price: 0, short: 'denuncia' }
                };
                const plan = planMap[categoryValue] || planMap['opt_support'];
                const channelName = `${plan.short}-${interaction.user.username}`.toLowerCase().slice(0, 32);

                const permissionOverwrites = [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ];
                if (staffRole) permissionOverwrites.push({ id: staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });

                let ticketChannel;
                try {
                    ticketChannel = await interaction.guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: interaction.channel.parentId,
                        topic: `Ticket de ${interaction.user.id} | Plano: ${plan.name}`,
                        permissionOverwrites: permissionOverwrites
                    });
                } catch (err) {
                    console.error("Erro ao criar ticket:", err);
                    await interaction.editReply({ content: `❌ Erro ao criar canal de ticket.` });
                    return;
                }

                // --- 1.3 MENSAGEM DE BOAS-VINDAS (V2) ---
                const welcomeContainer = new ContainerBuilder().setAccentColor(0x512DA8);

                if (plan.price > 0) {
                    welcomeContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# 👋 Atendimento Iniciado`),
                        new TextDisplayBuilder().setContent(`Olá ${interaction.user.toString()}, seu ticket de **${plan.name}** foi aberto com sucesso!\n\n` +
                            `Nossa equipe já foi notificada e em breve um especialista irá te atender.\n\n` +
                            `> 🚀 **Para agilizar:**\n` +
                            `> Por favor, informe seu **Processador** e **Placa de Vídeo** enquanto aguarda.\n` +
                            `> Se tiver dúvidas sobre o pagamento, pode perguntar aqui mesmo.`),
                        new TextDisplayBuilder().setContent(`${emojiMemberText} **Especialista:**\n\`Aguardando ser assumido...\``)
                    );
                } else {
                    welcomeContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# 🛠️ Suporte / Atendimento`),
                        new TextDisplayBuilder().setContent(`Olá ${interaction.user.toString()}, você abriu um ticket para **${plan.name}**.\n\n` +
                            `Um membro da nossa equipe de suporte entrará em contato em breve.\n\n` +
                            `> 📝 **Como podemos ajudar?**\n` +
                            `> Por favor, descreva sua dúvida ou problema com o máximo de detalhes possível.`),
                        new TextDisplayBuilder().setContent(`${emojiMemberText} **Status:**\n\`Aguardando Suporte...\``)
                    );
                }

                const innerMenu = new StringSelectMenuBuilder().setCustomId('ticket_inner_options').setPlaceholder('Selecione um painel')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Painel Membro').setValue('panel_member').setEmoji(emojiMemberId).setDescription('Opções do membro'),
                        new StringSelectMenuOptionBuilder().setLabel('Painel Staff').setValue('panel_staff').setEmoji(emojiSecurityId).setDescription('Opções da staff')
                    );

                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Assumir Ticket').setStyle(ButtonStyle.Secondary).setEmoji(emojiClaimId),
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Finalizar Ticket').setStyle(ButtonStyle.Danger).setEmoji(emojiTrashId)
                );

                welcomeContainer.addActionRowComponents(new ActionRowBuilder().addComponents(innerMenu), btnRow);
                await ticketChannel.send({ flags: MessageFlags.IsComponentsV2, components: [welcomeContainer] });

                // --- 1.3.1 HARDWARE COLLECTOR (IF OPTIMIZATION) ---
                if (plan.price > 0) {
                    const filter = m => m.author.id === interaction.user.id;
                    const collector = ticketChannel.createMessageCollector({ filter, max: 1, time: 300000 });

                    collector.on('collect', async m => {
                        const beautified = beautify(m.content);
                        const confirmContainer = new ContainerBuilder()
                            .setAccentColor(0x5865F2)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`🤖 **IA IDENTIFICOU SEU PC!**`),
                                new TextDisplayBuilder().setContent(`Pelo que você mandou, identifiquei esses componentes:\n\n**${beautified}**`),
                                new TextDisplayBuilder().setContent(`Acertei? Clique no botão abaixo para confirmar ou corrigir.`)
                            );
                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_specs_ok_${beautified}`).setLabel('Sim, está correto ✅').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('edit_specs_retry').setLabel('Não, quero corrigir ✏️').setStyle(ButtonStyle.Secondary)
                        );
                        await m.reply({ flags: MessageFlags.IsComponentsV2, components: [confirmContainer, row] });
                    });
                }

                // --- 1.4 NOTIFICAÇÃO DO DONO ---
                try {
                    const owner = await client.users.fetch(interaction.guild.ownerId);
                    const ownerContainer = new ContainerBuilder().setAccentColor(0x5865F2)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`🚀 **NOVO TICKET ABERTO**`),
                            new TextDisplayBuilder().setContent(`O usuário **${interaction.user.tag}** abriu um ticket para: **${plan.name}**\n📍 Canal: ${ticketChannel.toString()}`)
                        );
                    const ownerBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ir para o Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${ticketChannel.id}`));
                    await owner.send({ flags: MessageFlags.IsComponentsV2, components: [ownerContainer, ownerBtn] });
                } catch (e) { console.error("Erro ao notificar dono:", e); }

                // --- 1.5 CHECKOUT AUTOMÁTICO (SE FOR PLANO) ---
                if (plan.price > 0) {
                    const mistic = require('../mistic');

                    const startCheckout = async (isRetry = false) => {
                        try {
                            const txRef = `pix-${interaction.id.slice(0, 8)}-${isRetry ? 'retry' : 'init'}`;
                            const transaction = await mistic.createTransaction(plan.price, interaction.user.username, "00000000000", `Plano: ${plan.name}`, txRef);
                            const buffer = Buffer.from(transaction.qrCodeBase64.split(',')[1], 'base64');

                            const checkoutContainer = new ContainerBuilder().setAccentColor(0x5865F2)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`💎 **PAGAMENTO AUTOMÁTICO**`),
                                    new TextDisplayBuilder().setContent(`Para agilizar seu atendimento, realize o pagamento abaixo:\n\n` +
                                        `📦 **Plano:** ${plan.name}\n💰 **Valor:** R$ ${plan.price.toFixed(2)}\n\n⏳ **Aguardando confirmação...**`)
                                )
                                .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://pix_qrcode.png')))
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Pix Copia e Cola:**\n\`\`\`${transaction.copyPaste}\`\`\``));

                            const checkoutMsg = await ticketChannel.send({
                                flags: MessageFlags.IsComponentsV2,
                                components: [checkoutContainer],
                                files: [new AttachmentBuilder(buffer, { name: 'pix_qrcode.png' })]
                            });

                            const pollInterval = setInterval(async () => {
                                try {
                                    const statusData = await mistic.checkTransaction(transaction.transactionId);
                                    if (statusData && statusData.transactionState === 'COMPLETO') {
                                        clearInterval(pollInterval);

                                        // 1. Give Roles
                                        try {
                                            const member = await interaction.guild.members.fetch(interaction.user.id);

                                            // Grant Cliente Premium
                                            const clientRoleId = guildConfig.client_role_id;
                                            if (clientRoleId) await member.roles.add(clientRoleId);

                                            // Grant Specific Plan Role
                                            const planRoleIds = guildConfig.plan_role_ids || {};
                                            const specificRoleId = planRoleIds[categoryValue];
                                            if (specificRoleId) await member.roles.add(specificRoleId);
                                        } catch (e) { console.error("Error giving roles:", e); }

                                        // 2. Success Message
                                        const successContainer = new ContainerBuilder().setAccentColor(0x57F287)
                                            .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`✅ **PAGAMENTO CONFIRMADO!**`),
                                                new TextDisplayBuilder().setContent(`Olá ${interaction.user.toString()}, seu pagamento de **R$ ${plan.price.toFixed(2)}** foi processado!\n\n` +
                                                    `🚀 **PRÓXIMO PASSO:**\n` +
                                                    `1. Mande um print do seu FPS no treinamento (**ANTES**).\n` +
                                                    `2. Informe seu Processador e Placa de Vídeo.\n` +
                                                    `3. Entre na Call de Suporte agora mesmo!`)
                                            );
                                        await checkoutMsg.edit({ components: [successContainer], files: [] });
                                        await ticketChannel.setName(`aguardando-otm-${interaction.user.username}`);

                                        // DM DONO
                                        try {
                                            const owner = await client.users.fetch(interaction.guild.ownerId);
                                            await owner.send(`✅ **VENDA CONFIRMADA!**\nCliente: ${interaction.user.tag}\nValor: R$ ${plan.price.toFixed(2)}\nTicket: ${ticketChannel.toString()}`);
                                        } catch (e) { }
                                    }
                                } catch (e) { console.error("Poll Error:", e); }
                            }, 10000);

                            // AUTO RE-GEN (15 MIN)
                            setTimeout(async () => {
                                clearInterval(pollInterval);
                                try {
                                    const msgs = await ticketChannel.messages.fetch({ limit: 5 });
                                    if (msgs.has(checkoutMsg.id)) {
                                        await checkoutMsg.delete().catch(() => { });
                                        await ticketChannel.send({ content: "⚠️ [SYSTEM] Seu link de pagamento expirou. Gerando um novo automaticamente..." });
                                        await startCheckout(true);
                                    }
                                } catch (e) { }
                            }, 900000);

                        } catch (e) {
                            console.error("Checkout Error:", e);
                            await ticketChannel.send("❌ Erro ao gerar pagamento. Peça para a staff gerar manualmente.");
                        }
                    };

                    await startCheckout();
                }

                // --- 1.6 RESPOSTA FINAL NO BOT ---
                const rowGo = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ir para o Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${ticketChannel.id}`));
                await replyV2(interaction, {
                    content: `✅ **Ticket Criado com Sucesso!**\n\nSeu canal de atendimento foi aberto: ${ticketChannel.toString()}`,
                    color: 0x57F287,
                    components: [rowGo]
                });
                return;
            }

            // --- 2. SELEÇÃO PAINEL ---
            if (interaction.customId === 'ticket_inner_options') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const selected = interaction.values[0];

                if (selected === 'panel_member') {
                    const menu = new StringSelectMenuBuilder().setCustomId('member_actions_menu').setPlaceholder('Selecione uma opção...').addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Chamar Staff').setDescription('Notificar a staff.').setValue('member_call_staff').setEmoji(emojiBellId)
                    );
                    await replyV2(interaction, { title: 'Opções de Membro', color: 0x5865F2, components: [new ActionRowBuilder().addComponents(menu)] });

                } else if (selected === 'panel_staff') {
                    const menu = new StringSelectMenuBuilder().setCustomId('staff_actions_menu').setPlaceholder('Selecione uma opção...').addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('Chamar Usuário').setDescription('Notificar usuario.').setValue('staff_call_user').setEmoji(emojiBellId),
                        new StringSelectMenuOptionBuilder().setLabel('Adicionar Usuário').setDescription('Adicionar ao ticket.').setValue('staff_add_user').setEmoji(emojiCheckId),
                        new StringSelectMenuOptionBuilder().setLabel('Renomear Ticket').setDescription('Alterar nome.').setValue('staff_rename').setEmoji(emojiCheckId)
                    );
                    await replyV2(interaction, { title: 'Opções da Staff', color: 0xED4245, components: [new ActionRowBuilder().addComponents(menu)] });
                }
            }

            // --- 3. AÇÕES MENUS ---
            if (interaction.customId === 'member_actions_menu') {
                if (interaction.values[0] === 'member_call_staff') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const topic = interaction.channel.topic || "";
                    const claimedMatch = topic.match(/Claimed: (\d+)/);
                    const staffId = claimedMatch ? claimedMatch[1] : null;

                    if (staffId) {
                        try {
                            const staffUser = await client.users.fetch(staffId);
                            const linkBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ir para o Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}`));
                            const container = new ContainerBuilder().setAccentColor(0x5865F2)
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojiBellText} | **Solicitação de Suporte**\nO usuário ${interaction.user.toString()} está chamando no ticket!`));

                            await staffUser.send({ flags: MessageFlags.IsComponentsV2, components: [container, linkBtn.toJSON()] });
                            await replyV2(interaction, { content: `${emojiCheckText} O Staff responsável (<@${staffId}>) foi notificado no privado!`, color: 0x57F287 });
                        } catch (e) {
                            // Fallback
                            const container = new ContainerBuilder().setAccentColor(0xED4245).addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`${emojiBellText} | **Solicitação de Staff**`),
                                new TextDisplayBuilder().setContent(`O usuário ${interaction.user.toString()} solicita atendimento! <@${staffId}>`)
                            );
                            await interaction.channel.send({ content: `<@${staffId}>`, flags: MessageFlags.IsComponentsV2, components: [container] });
                            await replyV2(interaction, { content: `${emojiCheckText} Staff notificada!`, color: 0x57F287 });
                        }
                    } else {
                        // NEW: Notify Configured Staff Role if not claimed
                        const config = db.get(); // Get latest config
                        const staffRoleRequest = config.staff_role_id ? `<@&${config.staff_role_id}>` : '@here';

                        const container = new ContainerBuilder().setAccentColor(0xED4245).addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${emojiBellText} | **Solicitação de Staff**`),
                            new TextDisplayBuilder().setContent(`O usuário ${interaction.user.toString()} solicita atendimento! ${staffRoleRequest}`)
                        );
                        await interaction.channel.send({ content: `${staffRoleRequest}`, flags: MessageFlags.IsComponentsV2, components: [container] });
                        await replyV2(interaction, { content: `${emojiCheckText} Staff notificada!`, color: 0x57F287 });
                    }
                }
            }

            if (interaction.customId === 'staff_actions_menu') {
                const action = interaction.values[0];

                if (action === 'staff_rename') {
                    // Modal has no Defer before it
                    const modal = new ModalBuilder().setCustomId('modal_rename_ticket').setTitle('Renomear Ticket');
                    const input = new TextInputBuilder().setCustomId('input_new_name').setLabel('Novo Nome').setStyle(TextInputStyle.Short).setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                if (action === 'staff_call_user') {
                    const topic = interaction.channel.topic || "";
                    const userIdMatch = topic.match(/Ticket de.*?(\d+)/);
                    const targetId = userIdMatch ? userIdMatch[1] : null;

                    if (targetId) {
                        const container = new ContainerBuilder().setAccentColor(0x5865F2).addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${interaction.guild.name}**`),
                            new TextDisplayBuilder().setContent(`**Ticket | Notificação**`),
                            new TextDisplayBuilder().setContent(`${emojiBellText} | Olá <@${targetId}>. O usuário ${interaction.user.toString()} quer uma resposta sua!`)
                        );
                        const btnGo = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Ir para o Ticket').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}`));
                        await interaction.channel.send({ content: `<@${targetId}>`, flags: MessageFlags.IsComponentsV2, components: [container, btnGo.toJSON()] });
                        await replyV2(interaction, { content: `${emojiCheckText} Usuário notificado!`, color: 0x57F287 });
                    } else {
                        await replyV2(interaction, { content: `❌ Dono não encontrado. ID: ${targetId || 'N/A'}`, color: 0xED4245 });
                    }

                } else if (action === 'staff_add_user') {
                    const userSelect = new UserSelectMenuBuilder().setCustomId('staff_handle_add_user').setPlaceholder('Selecionar Usuário').setMaxValues(1);
                    await replyV2(interaction, { content: 'Selecione abaixo:', components: [new ActionRowBuilder().addComponents(userSelect)] });
                }
            }

            if (interaction.customId === 'staff_handle_add_user') {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const userId = interaction.values[0];
                await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
                await replyV2(interaction, { content: `${emojiCheckText} <@${userId}> adicionado.`, color: 0x57F287 });
            }

            // --- EMBED EDITOR LOGIC ---
            if (interaction.customId === 'select_embed_edit') {
                const value = interaction.values[0]; // channelId|embedId
                const [channelId, embedId] = value.split('|');

                const config = db.getGuild(interaction.guild.id);
                const savedEmbed = (config.embeds && config.embeds[channelId]) ? config.embeds[channelId] : null;

                const modal = new ModalBuilder().setCustomId(`modal_edit_v2_${channelId}`).setTitle('Editar Embed');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('edit_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(false).setValue(savedEmbed?.title || '').setPlaceholder('Novo título')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('edit_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(savedEmbed?.description || '').setPlaceholder('Conteúdo da mensagem usando Markdown...')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('edit_color').setLabel('Cor (Hex)').setStyle(TextInputStyle.Short).setRequired(false).setValue(savedEmbed?.color || '#5865F2').setPlaceholder('#5865F2')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('edit_footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false).setValue(savedEmbed?.footer || ''))
                );

                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('modal_edit_v2_')) {
                const channelId = interaction.customId.replace('modal_edit_v2_', '');

                const title = interaction.fields.getTextInputValue('edit_title');
                const description = interaction.fields.getTextInputValue('edit_desc');
                const colorHex = interaction.fields.getTextInputValue('edit_color') || '#5865F2';
                const footer = interaction.fields.getTextInputValue('edit_footer');

                const channel = interaction.guild.channels.cache.get(channelId);
                if (channel) {
                    try {
                        const container = new ContainerBuilder()
                            .setAccentColor(parseInt(colorHex.replace('#', ''), 16));

                        const texts = [];
                        if (title) texts.push(new TextDisplayBuilder().setContent(`# ${title}`));
                        texts.push(new TextDisplayBuilder().setContent(description));
                        if (footer) texts.push(new TextDisplayBuilder().setContent(`*${footer}*`));

                        container.addTextDisplayComponents(...texts);

                        // We can't easily "edit" the specific message unless we store the messageID. 
                        // For this simplified version, we will fetch the last bot message or send a new one.
                        // Ideally: db should store messageId.

                        // Pragmático: Fetch last bot message
                        const messages = await channel.messages.fetch({ limit: 10 });
                        const lastBotMsg = messages.find(m => m.author.id === client.user.id);

                        if (lastBotMsg) {
                            await lastBotMsg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
                            // Update DB
                            const config = db.getGuild(interaction.guild.id);
                            if (!config.embeds) config.embeds = {};
                            config.embeds[channelId] = { title, description, color: colorHex, footer };
                            db.setGuild(interaction.guild.id, 'embeds', config.embeds);

                            await interaction.reply({ content: '✅ Mensagem atualizada!', ephemeral: true });
                        } else {
                            await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
                            await interaction.reply({ content: '✅ Mensagem enviada (não achei anterior para editar)!', ephemeral: true });
                        }

                    } catch (err) {
                        console.error(err);
                        await interaction.reply({ content: '❌ Erro ao editar.', ephemeral: true });
                    }
                } else {
                    await interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
                }
            }

            // --- 4. TICKET CLAIM (LOGICA SPLIT) ---
            if (interaction.customId === 'ticket_claim') {
                // PRIMEIRO: Defer como Ephemeral para erros serem privados
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                // 1. SEGURANÇA: Verificar se é Staff
                const config = db.getGuild(interaction.guild.id);
                const staffRoleId = config.staff_role_id;

                if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await replyV2(interaction, {
                        title: 'Acesso Negado',
                        content: `${emojiErrorText || '❌'} Apenas membros da **equipe** podem assumir tickets!`,
                        color: 0xED4245,
                        ephemeral: true
                    });
                    return;
                }

                const oldTopic = interaction.channel.topic || "";

                // ERRO: Já assumido
                if (oldTopic.includes('Claimed:')) {
                    await replyV2(interaction, {
                        title: 'Erro',
                        content: `${emojiErrorText || '❌'} Este ticket já foi assumido!`,
                        color: 0xED4245,
                        ephemeral: true
                    });
                    return;
                }

                // SUCESSO: Processa
                await interaction.channel.setTopic(`${oldTopic} | Claimed: ${interaction.user.id}`);

                // ATUALIZAR MENSAGEM DO PAINEL
                try {
                    const originalMsg = interaction.message;
                    const newContainer = new ContainerBuilder()
                        .setAccentColor(0x2B2D31)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${emojiBellText} | Olá ${originalMsg.mentions.users.first() ? originalMsg.mentions.users.first().toString() : 'Usuário'}! Seja bem-vindo(a) ao seu ticket.`),
                            new TextDisplayBuilder().setContent(`⚡ | Os **TICKETS** são totalmente privados...`),
                            new TextDisplayBuilder().setContent(`🚨 | Evite **MARCAÇÕES**. Aguarde até que um **STAFF** te atenda.`),
                            new TextDisplayBuilder().setContent(`${emojiMemberText} | **Responsável:** ${interaction.user.toString()}`)
                        );

                    const innerMenu = new StringSelectMenuBuilder().setCustomId('ticket_inner_options').setPlaceholder('Selecione um painel')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('Painel Membro').setValue('panel_member').setEmoji(emojiMemberId).setDescription('Opções do membro'),
                            new StringSelectMenuOptionBuilder().setLabel('Painel Staff').setValue('panel_staff').setEmoji(emojiSecurityId).setDescription('Opções da staff')
                        );

                    const btnRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_claim').setLabel(`Assumido por ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setEmoji(emojiClaimId).setDisabled(true),
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Finalizar Ticket').setStyle(ButtonStyle.Danger).setEmoji(emojiTrashId)
                    );

                    newContainer.addActionRowComponents(new ActionRowBuilder().addComponents(innerMenu), btnRow);
                    await originalMsg.edit({ components: [newContainer] });

                } catch (e) { console.error("Erro ao atualizar painel:", e); }

                // RETORNO PARA O STAFF (EPHEMERAL)
                await replyV2(interaction, { content: `${emojiCheckText} Você assumiu este ticket!`, color: 0x57F287 });

                // AVISO PÚBLICO (GOLD)
                const container = new ContainerBuilder().setAccentColor(0xFEE75C)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojiClaimText} **Ticket Gerenciado**`),
                        new TextDisplayBuilder().setContent(`Este ticket agora é de responsabilidade de ${interaction.user.toString()}!`),
                        new TextDisplayBuilder().setContent(`⏰ **Início do Atendimento**: <t:${Math.floor(Date.now() / 1000)}:R>`)
                    );
                await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            }

            if (interaction.customId === 'ticket_close') {
                await interaction.reply({ content: '🔒 Fechando...', flags: MessageFlags.Ephemeral });
                setTimeout(() => interaction.channel.delete().catch(() => { }), 3000);
            }

        } catch (error) {
            console.error("Critical Interaction Error:", error);
            try {
                if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ Erro Crítico. Verifique logs.', flags: MessageFlags.Ephemeral });
            } catch (e) { }
        }
    },
};
