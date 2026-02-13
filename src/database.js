const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data.json');

// Default Config Template
const defaultConfig = {
    auto_role_id: null,
    staff_role_id: null,
    client_role_id: null, // Novo: Cargo para quem compra
    sales_channel_id: null,
    ticket_category_id: null, // Categoria para criar tickets
    logs_channel_id: null,
    results_channel_id: null, // Novo: Canal de Antes x Depois
    welcome_channel_id: null, // Canal de Boas-vindas
    welcome_message: null // Configuração da mensagem de boas-vindas
};

// Ensure data file exists with structure
function ensureData() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({ guilds: {}, users: {} }, null, 4));
        return { guilds: {}, users: {} };
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!data.guilds) data.guilds = {};
    if (!data.users) data.users = {};
    return data;
}

function load() {
    try {
        return ensureData();
    } catch (e) {
        console.error("Erro ao ler database:", e);
        return { guilds: {}, users: {} };
    }
}

function save(data) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));
        return true;
    } catch (e) {
        console.error("Erro ao salvar database:", e);
        return false;
    }
}

module.exports = {
    // --- GUILD CONFIGS ---
    getGuild: (guildId) => {
        const data = load();
        // Return saved config merged with defaults (to ensure keys exist)
        return { ...defaultConfig, ...(data.guilds[guildId] || {}) };
    },
    setGuild: (guildId, key, value) => {
        const data = load();
        if (!data.guilds[guildId]) data.guilds[guildId] = {};
        data.guilds[guildId][key] = value;
        save(data);
    },

    // --- USER DATA ---
    getUser: (userId) => {
        const data = load();
        return data.users[userId] || { products: [] };
    },
    setUser: (userId, userData) => {
        const data = load();
        data.users[userId] = userData;
        save(data);
    },

    // --- GENERIC ---
    load,
    save,
    get: (key) => {
        const data = load();
        return data[key];
    },
    set: (key, value) => {
        const data = load();
        data[key] = value;
        save(data);
    }
};
