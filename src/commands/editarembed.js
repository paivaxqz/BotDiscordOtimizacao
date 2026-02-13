const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const db = require('./database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editarembed')
        .setDescription('Edita uma embed/mensagem do servidor (Regras, Anúncios, etc)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // 1. Fetch available embeds from DB (saved by AI gen) OR scan for known channels
        const guildData = db.getGuild(interaction.guild.id);
        const embeds = guildData.server_embeds || [];

        // If no DB data, try to "guess" based on channels
        if (embeds.length === 0) {
            const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
            for (const [id, ch] of channels) {
                if (ch.name.includes('regras') || ch.name.includes('rules')) embeds.push({ id: 'rules', name: '📜 Regras', channelId: id });
                if (ch.name.includes('avisos') || ch.name.includes('news')) embeds.push({ id: 'news', name: '📢 Avisos', channelId: id });
            }
        }

        if (embeds.length === 0) {
            return interaction.reply({ content: '❌ Nenhuma embed configurável encontrada.', ephemeral: true });
        }

        // 2. Create Select Menu
        const menu = new StringSelectMenuBuilder()
            .setCustomId('select_embed_edit')
            .setPlaceholder('Selecione a mensagem para editar')
            .addOptions(
                embeds.map(e => new StringSelectMenuOptionBuilder()
                    .setLabel(e.name || e.id)
                    .setDescription(`Canal: <#${e.channelId}>`)
                    .setValue(e.channelId + '|' + e.id) // Pass channelID and ID
                    .setEmoji('📝')
                )
            );

        await interaction.reply({
            content: 'Selecione qual mensagem você deseja editar:',
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true
        });
    }
};
