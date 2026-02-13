require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('./database');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
    console.log('--- PREMIUM UI SETUP START ---');
    try {
        const guild = client.guilds.cache.first();
        if (!guild) {
            console.log('NO_GUILD_FOUND');
            process.exit(1);
        }

        const findChannel = (name) => guild.channels.cache.find(c => c.name.includes(name));

        // 1. #⚠️┃termos
        const chTermos = findChannel('termos');
        if (chTermos) {
            const container = new ContainerBuilder().setAccentColor(0x512DA8)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ⚖️ Termos de Uso & Garantia`),
                    new TextDisplayBuilder().setContent(`Ao utilizar nossos serviços, você concorda com os seguintes termos:\n\n` +
                        `> 📦 **Entrega**: O prazo médio é de 30 a 60 minutos após o pagamento.\n` +
                        `> 🛡️ **Segurança**: Não alteramos hardware nem solicitamos senhas pessoais.\n` +
                        `> 💸 **Reembolso**: Por se tratar de um serviço digital executado, não efetuamos estorno após a conclusão da otimização.\n\n` +
                        `**O uso indevido de bugs ou desrespeito à equipe resultará em banimento imediato.**`)
                );
            await chTermos.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            console.log('Sent #termos');
        }

        // 2. #📝┃sobre-nos
        const chSobre = findChannel('sobre-nos');
        if (chSobre) {
            const container = new ContainerBuilder().setAccentColor(0x512DA8)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# 🛠️ Sobre a JsOptimizer`),
                    new TextDisplayBuilder().setContent(`Somos especialistas em extrair o **máximo desempenho** do seu hardware para jogos competitivos.\n\n` +
                        `Nossa missão é reduzir a latência do sistema e estabilizar seu FPS, garantindo uma jogabilidade fluida e livre de travamentos.\n\n` +
                        `✅ + de 1000 máquinas otimizadas.\n` +
                        `✅ Técnicos especializados em Windows Kernel.\n` +
                        `✅ Foco total em Performance & Network.`)
                );
            await chSobre.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            console.log('Sent #sobre-nos');
        }

        // 3. #❔┃como-funciona
        const chComo = findChannel('como-funciona');
        if (chComo) {
            const container = new ContainerBuilder().setAccentColor(0x512DA8)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ⚡ Como Funciona?`),
                    new TextDisplayBuilder().setContent(`O processo da "Máquina" é simples e direto:\n\n` +
                        `1️⃣ **Compra**: Escolha seu plano no canal <#1471552599952982017> e realize o pagamento via PIX.\n` +
                        `2️⃣ **Setup**: Mande o print de ANTES (FPS) no ticket e entre na call de suporte.\n` +
                        `3️⃣ **Execução**: Nossa staff acessará sua máquina via AnyDesk/TeamViewer para aplicar os tweaks.\n` +
                        `4️⃣ **Validação**: Testamos juntos o resultado final e postamos sua prova de valor!`)
                );
            await chComo.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            console.log('Sent #como-funciona');
        }

        // 4. #🚀┃preço-otimização
        const chPreco = findChannel('preço-otimização');
        if (chPreco) {
            const container = new ContainerBuilder().setAccentColor(0x512DA8)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# 💎 Tabela de Preços`),
                    new TextDisplayBuilder().setContent(`Escolha o plano ideal para o seu perfil. Todos os serviços incluem suporte dedicado e garantia de satisfação.`),

                    new TextDisplayBuilder().setContent(`### ⚪ Otimização Básica — R$ 20,00\n*Limpeza Leve & Windows Debloat*`),
                    new TextDisplayBuilder().setContent(`### 🔵 Turbo Economic — R$ 55,90\n*Foco em FPS & Estabilidade para Jogos*`),
                    new TextDisplayBuilder().setContent(`### 🟡 Otimização Avançada — R$ 79,90\n*Tweaks Completos + Otimização de Rede High-End*`),
                    new TextDisplayBuilder().setContent(`### 🔴 Pro & Streamer — R$ 120,00\n*O Máximo que seu PC pode entregar + Configuração OBS*`),
                    new TextDisplayBuilder().setContent(`### 💻 Plus Notebook — R$ 89,90\n*Otimização Térmica e de Bateria para Laptops*`)
                );
            await chPreco.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            console.log('Sent #preço-otimização');
        }

        // 5. #🎫┃ticket
        const chTicket = findChannel('ticket');
        if (chTicket) {
            const container = new ContainerBuilder().setAccentColor(0x512DA8)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ⚡ Central de Otimizações — Suporte Profissional`),
                    new TextDisplayBuilder().setContent(`Seja bem-vindo(a) ao atendimento especializado em **Otimização**!\n\n` +
                        `☑️ Escolha abaixo o plano de otimização desejado.\n` +
                        `☑️ Ninguém da nossa equipe solicitará sua senha.`)
                );

            const select = new StringSelectMenuBuilder()
                .setCustomId('ticket_category')
                .setPlaceholder('Escolha o seu plano de Otimização')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Suporte / Dúvidas').setDescription('Precisa de ajuda ou tirar dúvidas?').setValue('opt_support').setEmoji('📞'),
                    new StringSelectMenuOptionBuilder().setLabel('Otimização Básica').setDescription('Windows R$ 20,00').setValue('opt_basic').setEmoji('⚪'),
                    new StringSelectMenuOptionBuilder().setLabel('Otimização Turbo Economic').setDescription('Windows R$ 55,90').setValue('opt_turbo').setEmoji('🔵'),
                    new StringSelectMenuOptionBuilder().setLabel('Otimização Avançada').setDescription('Windows R$ 79,90').setValue('opt_advanced').setEmoji('🟡'),
                    new StringSelectMenuOptionBuilder().setLabel('Otimização Pro & Streamer').setDescription('Windows R$ 120,00').setValue('opt_pro').setEmoji('🔴'),
                    new StringSelectMenuOptionBuilder().setLabel('Otimização Plus para Notebook').setDescription('Windows R$ 89,90').setValue('opt_notebook').setEmoji('💻')
                );

            const row = new ActionRowBuilder().addComponents(select);
            container.addActionRowComponents(row);

            await chTicket.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
            console.log('Sent #ticket');

            // Auto Update DB for ticket channel id?
            db.setGuild(guild.id, 'ticket_channel_id', chTicket.id);
        }

        console.log('--- PREMIUM UI SETUP COMPLETE ---');
    } catch (e) {
        console.error('UI_SETUP_ERROR:', e);
    }
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
