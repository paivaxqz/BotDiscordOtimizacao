const { Events, GuildBan, EmbedBuilder } = require('discord.js');

class AntiRaid {
    constructor() {
        this.joinsInLastMinute = new Map(); // guildId -> array of timestamps
        this.channelCreations = new Map(); // guildId -> array of timestamps
        this.channelDeletions = new Map(); // guildId -> array of timestamps
        this.suspiciousUsers = new Set(); // userIds
        this.raidThreshold = 5; // número de joins em 1 minuto para considerar raid
        this.channelThreshold = 3; // número de canais criados/deletados em 1 minuto
        this.checkInterval = 60000; // 1 minuto
        this.raidMode = new Map(); // guildId -> boolean
    }

    async handleMemberJoin(member) {
        const guildId = member.guild.id;
        const now = Date.now();

        // Inicializa array se não existir
        if (!this.joinsInLastMinute.has(guildId)) {
            this.joinsInLastMinute.set(guildId, []);
        }

        const joins = this.joinsInLastMinute.get(guildId);
        
        // Remove joins mais antigos que 1 minuto
        const recentJoins = joins.filter(timestamp => now - timestamp < this.checkInterval);
        this.joinsInLastMinute.set(guildId, recentJoins);

        // Adiciona join atual
        recentJoins.push(now);

        // Verifica se está em raid
        if (recentJoins.length >= this.raidThreshold) {
            console.log(`[ANTI-RAID] RAID DETECTADO em ${member.guild.name}! ${recentJoins.length} joins em 1 minuto`);
            await this.handleRaid(member.guild);
        }

        // Verifica usuário suspeito (conta nova)
        const accountAge = now - member.user.createdTimestamp;
        const daysOld = accountAge / (1000 * 60 * 60 * 24);
        
        if (daysOld < 7) {
            console.log(`[ANTI-RAID] Conta suspeita detectada: ${member.user.tag} (${daysOld.toFixed(1)} dias)`);
            this.suspiciousUsers.add(member.user.id);
            
            // Ação para contas suspeitas
            await this.handleSuspiciousUser(member);
        }
    }

    async handleChannelCreation(channel) {
        const guildId = channel.guild.id;
        const now = Date.now();

        if (!this.channelCreations.has(guildId)) {
            this.channelCreations.set(guildId, []);
        }

        const creations = this.channelCreations.get(guildId);
        const recentCreations = creations.filter(timestamp => now - timestamp < this.checkInterval);
        this.channelCreations.set(guildId, recentCreations);
        recentCreations.push(now);

        if (recentCreations.length >= this.channelThreshold) {
            console.log(`[ANTI-RAID] CRIAÇÃO MASSIVA DE CANAIS detectada em ${channel.guild.name}! ${recentCreations.length} canais em 1 minuto`);
            await this.handleChannelRaid(channel.guild, 'creation');
        }
    }

    async handleChannelDeletion(channel) {
        const guildId = channel.guild.id;
        const now = Date.now();

        if (!this.channelDeletions.has(guildId)) {
            this.channelDeletions.set(guildId, []);
        }

        const deletions = this.channelDeletions.get(guildId);
        const recentDeletions = deletions.filter(timestamp => now - timestamp < this.checkInterval);
        this.channelDeletions.set(guildId, recentDeletions);
        recentDeletions.push(now);

        if (recentDeletions.length >= this.channelThreshold) {
            console.log(`[ANTI-RAID] EXCLUSÃO MASSIVA DE CANAIS detectada em ${channel.guild.name}! ${recentDeletions.length} canais em 1 minuto`);
            await this.handleChannelRaid(channel.guild, 'deletion');
        }
    }

    async handleChannelRaid(guild, type) {
        try {
            // Ativa modo raid extremo
            this.raidMode.set(guild.id, true);

            const logChannel = guild.channels.cache.find(ch => ch.name.includes('log') || ch.name.includes('staff'));
            
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 RAID DE CANAIS DETECTADO!')
                    .setDescription(`**ATAQUE DETECTADO:** ${type === 'creation' ? 'Criação' : 'Exclusão'} massiva de canais!`)
                    .setColor('#FF0000')
                    .setTimestamp()
                    .addFields(
                        { name: 'Tipo', value: type === 'creation' ? 'Criação Massiva' : 'Exclusão Massiva', inline: true },
                        { name: 'Ação', value: 'Modo de proteção MAXIMO ativado', inline: true },
                        { name: 'Status', value: 'Servidor em lockdown', inline: true }
                    );
                
                await logChannel.send({ embeds: [embed] });
            }

            // Ações extremas de proteção
            await this.activateLockdown(guild);
            
        } catch (error) {
            console.error('[ANTI-RAID] Erro ao lidar com raid de canais:', error);
        }
    }

    async activateLockdown(guild) {
        try {
            console.log(`[ANTI-RAID] ATIVANDO LOCKDOWN EM ${guild.name}`);
            
            // Tenta banir todos os membros que entraram recentemente (exceto admins)
            const recentJoins = this.joinsInLastMinute.get(guild.id) || [];
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            
            for (const member of guild.members.cache.values()) {
                if (member.joinedTimestamp && member.joinedTimestamp > fiveMinutesAgo) {
                    // Pula se for admin ou tiver cargo de admin
                    if (!member.permissions.has('Administrator') && !member.user.bot) {
                        try {
                            await member.ban({ reason: 'RAID PROTECTION - Auto-ban' });
                            console.log(`[ANTI-RAID] Banido ${member.user.tag} por suspeita de raid`);
                        } catch (err) {
                            console.log(`[ANTI-RAID] Falha ao banir ${member.user.tag}:`, err.message);
                        }
                    }
                }
            }

            // Define permissões para não permitir criação de canais
            const everyoneRole = guild.roles.everyone;
            await everyoneRole.setPermissions(['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY']).catch(() => {});
            
            console.log('[ANTI-RAID] LOCKDOWN ATIVADO - Servidor protegido');
            
        } catch (error) {
            console.error('[ANTI-RAID] Erro ao ativar lockdown:', error);
        }
    }

    async handleRaid(guild) {
        try {
            // Envia alerta para algum canal de logs se existir
            const logChannel = guild.channels.cache.find(ch => ch.name.includes('log') || ch.name.includes('staff'));
            
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 RAID DETECTADO!')
                    .setDescription(`**${this.joinsInLastMinute.get(guild.id).length}** usuários entraram em menos de 1 minuto!`)
                    .setColor('#FF0000')
                    .setTimestamp()
                    .addFields(
                        { name: 'Ação', value: 'Modo anti-raid ativado', inline: true },
                        { name: 'Status', value: 'Monitorando novos membros', inline: true }
                    );
                
                await logChannel.send({ embeds: [embed] });
            }

            // Ativa modo de verificação para novos membros
            // Aqui você pode adicionar lógica como colocar em um canal de verificação
            
        } catch (error) {
            console.error('[ANTI-RAID] Erro ao lidar com raid:', error);
        }
    }

    async handleSuspiciousUser(member) {
        try {
            // Coloca o usuário em um cargo de verificação ou mute temporário
            const guild = member.guild;
            
            // Procura por cargo de "Verificação" ou similar
            let verifyRole = guild.roles.cache.find(role => 
                role.name.toLowerCase().includes('verif') || 
                role.name.toLowerCase().includes('suspeito') ||
                role.name.toLowerCase().includes('mute')
            );

            if (!verifyRole) {
                // Cria um cargo de verificação se não existir
                verifyRole = await guild.roles.create({
                    name: '🔍 Em Verificação',
                    color: '#FFA500',
                    permissions: []
                });
                
                // Remove permissões de enviar mensagens em todos os canais
                guild.channels.cache.forEach(async channel => {
                    await channel.permissionOverwrites.create(verifyRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false
                    });
                });
            }

            await member.roles.add(verifyRole);
            console.log(`[ANTI-RAID] Usuário ${member.user.tag} colocado em verificação`);

        } catch (error) {
            console.error('[ANTI-RAID] Erro ao lidar com usuário suspeito:', error);
        }
    }

    async handleMemberLeave(member) {
        try {
            console.log(`[TICKET] Usuário ${member.user.tag} saiu do servidor. Verificando tickets abertos...`);
            
            // Procurar por tickets abertos por este usuário
            const guild = member.guild;
            const ticketChannels = guild.channels.cache.filter(channel => 
                channel.type === 0 && // Text channel
                channel.name.includes(member.user.username.toLowerCase()) &&
                channel.parent // Está em uma categoria
            );

            for (const [channelId, channel] of ticketChannels) {
                try {
                    const newName = `❌-${channel.name.replace(/^[^-]+-/, '')}`;
                    await channel.setName(newName);
                    
                    // Enviar mensagem no canal avisando que o usuário saiu
                    const embed = {
                        title: '🚫 Usuário Saiu do Servidor',
                        description: `O usuário ${member.user.tag} saiu do servidor e este ticket foi arquivado automaticamente.`,
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    };
                    
                    await channel.send({ embeds: [embed] });
                    console.log(`[TICKET] Ticket ${channel.name} renomeado para ${newName}`);
                } catch (error) {
                    console.error(`[TICKET] Erro ao renomear canal ${channel.name}:`, error);
                }
            }
        } catch (error) {
            console.error('[TICKET] Erro ao handleMemberLeave:', error);
        }
    }

    async checkMassLeave(guild) {
        // Detecta quando muitos usuários saem de uma vez (possível raid reverso)
        const now = Date.now();
        const recentLeaves = (guild.recentLeaves || []).filter(timestamp => now - timestamp < this.checkInterval);
        guild.recentLeaves = recentLeaves;

        if (recentLeaves.length >= this.raidThreshold) {
            console.log(`[ANTI-RAID] Mass leave detectado em ${guild.name}! ${recentLeaves.length} saídas em 1 minuto`);
        }
    }
}

// Exporta a classe e o evento
const antiRaid = new AntiRaid();

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        await antiRaid.handleMemberJoin(member);
    },
    antiRaid // Exporta a instância para uso em outros lugares
};

// Evento para quando usuário sai do servidor
module.exports.guildMemberRemove = {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member) {
        await antiRaid.handleMemberLeave(member);
    }
};
