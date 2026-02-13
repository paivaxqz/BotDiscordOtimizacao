// 4. #🚀┃preço-otimização
const chPreco = findChannel('preço-otimização');
if (chPreco) {
    const container = new ContainerBuilder().setAccentColor(0x512DA8)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# 💎 Tabela de Preços`),
            new TextDisplayBuilder().setContent(`Escolha o plano ideal para o seu perfil. Todos os serviços incluem suporte dedicado e garantia de satisfação.`),

            // Separador visual ou apenas espaçamento via componentes distintos
            new TextDisplayBuilder().setContent(`### ⚪ Otimização Básica\n**R$ 20,00**\n*Windows Lite & Cleanup*`),
            new TextDisplayBuilder().setContent(`### 🔵 Turbo Economic\n**R$ 55,90**\n*Foco em FPS & Estabilidade*`),
            new TextDisplayBuilder().setContent(`### 🟡 Otimização Avançada\n**R$ 79,90**\n*Full Tweaks + Network High-End*`),
            new TextDisplayBuilder().setContent(`### 🔴 Pro & Streamer\n**R$ 120,00**\n*Máximo Desempenho + OBS Setup*`),
            new TextDisplayBuilder().setContent(`### 💻 Plus Notebook\n**R$ 89,90**\n*Especial para Laptops & Temperatura*`)
        );
    await chPreco.send({ flags: MessageFlags.IsComponentsV2, components: [container] });
    console.log('Sent #preço-otimização');
}
