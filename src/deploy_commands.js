require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const commands = [
    // Comandos essenciais para servidor de hack
    new SlashCommandBuilder()
        .setName('registrar')
        .setDescription('Registrar venda e dar cargo ao cliente')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(option => option.setName('cliente').setDescription('Cliente que comprou').setRequired(true))
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('Produto vendido')
                .setRequired(true)
                .addChoices(
                    { name: 'VS Bypass - Basic', value: 'VS Bypass (Basic)' },
                    { name: 'VS Bypass - Advanced', value: 'VS Bypass (Advanced)' },
                    { name: 'IOS Trick', value: 'IOS Trick' }
                )
        )
        .addStringOption(option =>
            option.setName('duracao')
                .setDescription('Duração do acesso')
                .setRequired(true)
                .addChoices(
                    { name: '7 Dias', value: '7 Dias' },
                    { name: '30 Dias', value: '30 Dias' },
                    { name: 'Vitalício', value: 'Vitalício' }
                )
        )
        .addStringOption(option => option.setName('valor').setDescription('Valor pago').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('gerarpix')
        .setDescription('Gerar QR Code Pix para pagamento')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('Produto')
                .setRequired(true)
                .addChoices(
                    { name: 'VS Bypass - Basic', value: 'VS Bypass (Basic)' },
                    { name: 'VS Bypass - Advanced', value: 'VS Bypass (Advanced)' },
                    { name: 'IOS Trick', value: 'IOS Trick' }
                )
        )
        .addStringOption(option => option.setName('valor').setDescription('Valor (Ex: 15.50)').setRequired(true))
        .addUserOption(option => option.setName('cliente').setDescription('Cliente').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('botconfig')
        .setDescription('Configurar cargos e canais do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('setup_tickets')
        .setDescription('Criar painel de tickets no canal atual')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Limpar mensagens do canal')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option => option.setName('quantidade').setDescription('Número de mensagens (1-100)').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Ativar ou desativar o sistema anti-raid')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('acao')
                .setDescription('Escolha uma ação')
                .setRequired(true)
                .addChoices(
                    { name: 'Ativar', value: 'ativar' },
                    { name: 'Desativar', value: 'desativar' }
                )
        ),
    
    new SlashCommandBuilder()
        .setName('criarembed')
        .setDescription('Criar uma embed personalizada com modal')
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
