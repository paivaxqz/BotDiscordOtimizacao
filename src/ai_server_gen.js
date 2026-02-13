require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa a API do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

/**
 * Gera a estrutura do servidor com base no tema.
 * @param {string} theme - O tema do servidor (ex: RPG, Loja, Comunidade).
 * @param {string} type - Tipo de interação ('analysis' ou 'correction').
 * @param {Array} history - Histórico da conversa (opcional).
 * @returns {Promise<Object>} - Retorna um objeto com o blueprint ou uma pergunta.
 */
async function generateServerStructure(theme, type = 'analysis', history = []) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = "";

        if (type === 'analysis') {
            prompt = `
            Você é um arquiteto especialista em servidores do Discord.
            O usuário quer criar um servidor com o tema: "${theme}".

            Se o tema for muito vago (ex: "servidor legal", "bot"), retorne um JSON do tipo "question" pedindo mais detalhes.
            Se o tema for claro (ex: "RPG de Mesa", "Loja de Informática", "Comunidade de Jogos"), gere um JSON do tipo "blueprint" com a estrutura completa.

            Formato de Resposta (JSON APENAS):

            CASO 1: PERGUNTA (Se precisar de mais detalhes)
            {
                "type": "question",
                "content": "A pergunta que você quer fazer para entender melhor o tema."
            }

            CASO 2: BLUEPRINT (Se o tema estiver claro)
            {
                "type": "blueprint",
                "theme_name": "Nome Criativo do Servidor",
                "explanation": "Breve explicação da estrutura e do tema.",
                "categories": [
                    {
                        "name": "Nome da Categoria (com emojis)",
                        "channels": [
                            { "name": "nome-do-canal", "type": "GUILD_TEXT" },
                            { "name": "Nome do Voice", "type": "GUILD_VOICE" }
                        ]
                    }
                ],
                "roles": [
                    { "name": "Nome do Cargo", "color": "#HEXCODE", "permissions": [] }
                ]
            }

            Gere APENAS o JSON, sem markdown ou explicações extras.
            `;
        } else {
            // Lógica para correção/histórico (simplificada por enquanto)
            prompt = `O usuário respondeu à sua pergunta sobre o servidor do tema "${theme}". Responda com o JSON do blueprint final baseado no histórico.`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Limpeza básica para garantir JSON válido (remove markdown ```json ... ```)
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Erro na IA:", error);
        // Fallback em caso de erro/limite da API
        return {
            type: "blueprint",
            theme_name: `${theme} (Backup)`,
            explanation: "Estrutura básica gerada (IA indisponível no momento).",
            categories: [
                {
                    "name": "📜 Geral",
                    "channels": [
                        { "name": "💬・chat-geral", "type": "GUILD_TEXT" },
                        { "name": "📢・avisos", "type": "GUILD_TEXT" }
                    ]
                },
                {
                    "name": "🔊 Voz",
                    "channels": [
                        { "name": "🔈・Conversa", "type": "GUILD_VOICE" }
                    ]
                }
            ],
            roles: []
        };
    }
}

module.exports = { generateServerStructure };
