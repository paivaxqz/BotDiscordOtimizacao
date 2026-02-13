// Node 18+ has native fetch. No require needed.
require('dotenv').config();

const BASE_URL = 'https://api.misticpay.com/api';
const CLIENT_ID = process.env.MISTIC_CLIENT_ID;
const CLIENT_SECRET = process.env.MISTIC_CLIENT_SECRET;

const HEADERS = {
    'ci': CLIENT_ID,
    'cs': CLIENT_SECRET,
    'Content-Type': 'application/json'
};

module.exports = {
    /**
     * Create a Pix Transaction
     * @param {number} amount - Value in BRL (e.g. 10.50)
     * @param {string} payerName - Name of payer
     * @param {string} payerDocument - CPF (digits only)
     * @param {string} description - Product description
     * @param {string} externalId - Unique ID (ticket-id or similar)
     */
    async createTransaction(amount, payerName, payerDocument, description, externalId) {
        try {
            const body = {
                amount: parseFloat(amount),
                payerName: payerName,
                payerDocument: payerDocument.replace(/\D/g, ''), // Remove non-digits
                transactionId: externalId,
                description: description
            };

            const response = await fetch(`${BASE_URL}/transactions/create`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(body)
            });

            const json = await response.json();

            if (!response.ok) {
                console.error('[MisticPay] Error creating transaction:', json);
                throw new Error(json.message || 'Failed to create transaction');
            }

            return json.data; // { qrCodeBase64, copyPaste, transactionId, ... }
        } catch (error) {
            console.error('[MisticPay] Exception:', error);
            throw error;
        }
    },

    /**
     * Check Transaction Status
     * @param {string} transactionId - The ID returned by MisticPay (not the external one)
     */
    async checkTransaction(transactionId) {
        try {
            const body = { transactionId: transactionId };

            const response = await fetch(`${BASE_URL}/transactions/check`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(body)
            });

            const json = await response.json();

            if (!response.ok) {
                // Rate limit handling could go here
                console.error('[MisticPay] Error checking status:', json);
                return null;
            }

            return json.transaction; // { transactionState: 'COMPLETO' | 'PENDENTE', ... }
        } catch (error) {
            console.error('[MisticPay] Check Exception:', error);
            return null;
        }
    }
};
