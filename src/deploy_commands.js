require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('botconfig')
        .setDescription('Configurar o sistema do bot (AutoRole, Staff, Tickets)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Criar uma mensagem personalizada V2')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('registrar')
        .setDescription('Registrar uma venda e setar perfil do cliente')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => option.setName('cliente').setDescription('O cliente que comprou').setRequired(true))
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('Qual produto foi vendido')
                .setRequired(true)
                .addChoices(
                    { name: 'VS Bypass - Basic', value: 'VS Bypass (Basic)' },
                    { name: 'VS Bypass - Advanced', value: 'VS Bypass (Advanced)' },
                    { name: 'IOS Trick', value: 'IOS Trick' }
                )
        )
        .addStringOption(option =>
            option.setName('duracao')
                .setDescription('Tempo do plano')
                .setRequired(true)
                .addChoices(
                    { name: '7 Dias', value: '7 Dias' },
                    { name: '30 Dias', value: '30 Dias' },
                    { name: 'Vitalício', value: 'Vitalício' }
                )
        )
        .addStringOption(option => option.setName('valor').setDescription('Valor da venda (Ex: 50,00)').setRequired(true))
        .addAttachmentOption(option => option.setName('comprovante').setDescription('Print do pagamento (Arquivo)').setRequired(false))
        .addStringOption(option => option.setName('link_comprovante').setDescription('Link do print (Imgur, Discord, etc)').setRequired(false)),
    new SlashCommandBuilder()
        .setName('gerarpix')
        .setDescription('Gerar pagamento Pix Automático (MisticPay)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('Selecione o Produto')
                .setRequired(true)
                .addChoices(
                    { name: 'VS Bypass - Basic', value: 'VS Bypass (Basic)' },
                    { name: 'VS Bypass - Advanced', value: 'VS Bypass (Advanced)' },
                    { name: 'IOS Trick', value: 'IOS Trick' }
                )
        )
        .addStringOption(option => option.setName('valor').setDescription('Valor (Ex: 15,50 ou 15.50)').setRequired(true))
        .addUserOption(option => option.setName('cliente').setDescription('Cliente que receberá o produto').setRequired(true)),
    new SlashCommandBuilder()
        .setName('criarserver')
        .setDescription('⚠️ DESTRÓI TUDO e cria um servidor novo com IA (Gemini)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option.setName('tema').setDescription('O tema do servidor (Ex: RPG, Loja, Comunidade)').setRequired(true))
        .addBooleanOption(option => option.setName('usar_emojis').setDescription('Usar emojis nos canais?').setRequired(true))
        .addStringOption(option => option.setName('divisoria').setDescription('Símbolo divisória (Ex: | - » •)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('editarembed')
        .setDescription('Edita uma mensagem/embed do servidor (Regras, Anúncios, etc)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('postar_resultado')
        .setDescription('Postar o resultado Antes x Depois de uma otimização')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => option.setName('cliente').setDescription('O cliente da otimização').setRequired(true))
        .addAttachmentOption(option => option.setName('depois_print').setDescription('A print de DEPOIS da otimização').setRequired(true)),
    new SlashCommandBuilder()
        .setName('aprovarpagamento')
        .setDescription('Aprovar pagamento manualmente e disparar fluxo de hardware')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => option.setName('cliente').setDescription('O cliente que realizou o pagamento').setRequired(true)),
    new ContextMenuCommandBuilder()
        .setName('Postar Resultado')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Iniciando atualização de comandos (/) ...');
        if (!process.env.DISCORD_TOKEN) throw new Error("TOKEN NOT FOUND IN .ENV");
        console.log(`Token loaded (Length: ${process.env.DISCORD_TOKEN.length})`);

        const currentUser = await rest.get(Routes.user());
        const clientId = currentUser.id;
        console.log(`Client ID detectado: ${clientId}`);

        // Tenta pegar as guildas do bot
        const guilds = await rest.get(Routes.userGuilds());

        console.log(`Encontradas ${guilds.length} guildas. Iniciando registro instantâneo...`);

        // 1. Registra em CADA guilda (Instantâneo)
        for (const guild of guilds) {
            try {
                console.log(`Registrando na Guild: ${guild.name} (${guild.id})...`);
                await rest.put(
                    Routes.applicationGuildCommands(clientId, guild.id),
                    { body: commands },
                );
                console.log(`[SUCESSO] Comandos registrados em ${guild.name}`);
            } catch (err) {
                console.error(`[ERRO] Falha ao registrar em ${guild.name}:`, err);
            }
        }

        // 2. Registra GLOBALMENTE (Backup/Futuro)
        console.log("\nRegistrando comandos GLOBALMENTE (Backup)...");
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Comandos registrados GLOBALMENTE com sucesso!');

    } catch (error) {
        console.error(error);
    }
})();
