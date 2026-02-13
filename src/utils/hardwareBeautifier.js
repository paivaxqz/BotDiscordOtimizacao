/**
 * Hardware Beautifier Utility
 * Maps messy user input (e.g., "i5 10th", "3060ti") to clean, professional names.
 */

const cpuPatterns = [
    { regex: /i3[- ]?(\d+)/i, name: 'Intel Core i3-$1' },
    { regex: /i5[- ]?(\d+)/i, name: 'Intel Core i5-$1' },
    { regex: /i7[- ]?(\d+)/i, name: 'Intel Core i7-$1' },
    { regex: /i9[- ]?(\d+)/i, name: 'Intel Core i9-$1' },
    { regex: /ryzen[- ]?3[- ]?(\d+)/i, name: 'AMD Ryzen 3 $1' },
    { regex: /ryzen[- ]?5[- ]?(\d+)/i, name: 'AMD Ryzen 5 $1' },
    { regex: /ryzen[- ]?7[- ]?(\d+)/i, name: 'AMD Ryzen 7 $1' },
    { regex: /ryzen[- ]?9[- ]?(\d+)/i, name: 'AMD Ryzen 9 $1' },
    { regex: /xeon/i, name: 'Intel Xeon' }
];

const gpuPatterns = [
    { regex: /(rtx|gtx)[- ]?(\d+)[- ]?(ti|super)?/i, name: (m, p1, p2, p3) => `NVIDIA GeForce ${p1.toUpperCase()} ${p2}${p3 ? ' ' + p3.charAt(0).toUpperCase() + p3.slice(1).toLowerCase() : ''}` },
    { regex: /rx[- ]?(\d+)[- ]?(xt)?/i, name: (m, p1, p2) => `AMD Radeon RX ${p1}${p2 ? ' ' + p2.toUpperCase() : ''}` },
    { regex: /radeon/i, name: 'AMD Radeon' }
];

function beautify(rawText) {
    let cpu = 'Processador não identificado';
    let gpu = 'Placa de Vídeo não identificada';

    // CPU Search
    for (const p of cpuPatterns) {
        const match = rawText.match(p.regex);
        if (match) {
            cpu = p.name.replace('$1', match[1] || '');
            break;
        }
    }

    // GPU Search
    for (const p of gpuPatterns) {
        const match = rawText.match(p.regex);
        if (match) {
            if (typeof p.name === 'function') {
                gpu = p.name(...match);
            } else {
                gpu = p.name;
            }
            break;
        }
    }

    return `${cpu} & ${gpu}`;
}

module.exports = { beautify };
