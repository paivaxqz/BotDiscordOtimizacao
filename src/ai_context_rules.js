// CONTEXTOS ESPECÍFICOS PARA A IA
// Este arquivo contém regras de contexto para melhorar a geração de servidores

const CONTEXT_RULES = {
    "loja de hack": {
        keywords: ["hack", "cheat", "script", "exploit", "mod menu"],
        categories: [
            "💻 | PRODUTOS DIGITAIS",
            "🛡️ | SUPORTE TÉCNICO",
            "💬 | COMUNIDADE CYBER",
            "📢 | UPDATES & LANÇAMENTOS",
            "🎯 | TUTORIAIS & GUIAS"
        ],
        avoid: ["bazar", "marketplace genérico"]
    },
    "loja de roupas": {
        keywords: ["roupa", "moda", "vestuário", "fashion"],
        categories: [
            "👕 | CATÁLOGO",
            "🛒 | PEDIDOS",
            "📦 | ENTREGAS",
            "💬 | COMUNIDADE FASHION"
        ]
    },
    "gaming": {
        keywords: ["game", "jogo", "valorant", "cs", "fortnite", "lol"],
        categories: [
            "🎮 | GAMEPLAY",
            "🏆 | COMPETITIVO",
            "💬 | COMUNIDADE",
            "📢 | UPDATES"
        ]
    }
};

module.exports = { CONTEXT_RULES };
