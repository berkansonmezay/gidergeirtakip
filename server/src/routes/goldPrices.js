import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

// Gold type mapping: API key -> display name
const GOLD_MAP = {
  'gram-altin': 'Gr Altın',
  'ceyrek-altin': 'Çeyrek',
  'yarim-altin': 'Yarım',
  'tam-altin': 'Tam',
  'cumhuriyet-altini': 'Cumhuriyet',
  'ata-altin': 'Ata Lira',
};

// Parse Turkish formatted number (e.g. "6.625,36" -> 6625.36)
function parseTurkishNumber(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

router.get('/', async (req, res) => {
  try {
    const response = await fetch('https://finans.truncgil.com/today.json');
    if (!response.ok) throw new Error('API yanıt vermedi');
    
    const data = await response.json();
    const prices = {};

    for (const [apiKey, displayName] of Object.entries(GOLD_MAP)) {
      if (data[apiKey]) {
        prices[displayName] = {
          buy: parseTurkishNumber(data[apiKey]['Alış']),
          sell: parseTurkishNumber(data[apiKey]['Satış']),
          change: data[apiKey]['Değişim'] || '%0,00',
        };
      }
    }

    // Also include USD and EUR for potential future use
    if (data['USD']) {
      prices['USD'] = {
        buy: parseTurkishNumber(data['USD']['Alış']),
        sell: parseTurkishNumber(data['USD']['Satış']),
        change: data['USD']['Değişim'] || '%0,00',
      };
    }
    if (data['EUR']) {
      prices['EUR'] = {
        buy: parseTurkishNumber(data['EUR']['Alış']),
        sell: parseTurkishNumber(data['EUR']['Satış']),
        change: data['EUR']['Değişim'] || '%0,00',
      };
    }

    res.json({ 
      prices, 
      updateDate: data['Update_Date'] || new Date().toISOString() 
    });
  } catch (err) {
    console.error('Gold Prices API Error:', err);
    res.status(500).json({ error: 'Altın fiyatları alınamadı.' });
  }
});

export default router;
