require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const { fetchStockQuote, fetchGoldQuote, fetchTimeSeries, calculateSupportResistance, fetchTechnicalIndicators, fetchNews } = require('./dataFetchers');
const { generatePriceChartUrl, generateSRChartUrl } = require('./chartGenerator');
const { buildStockCard, buildDetailMenu, buildSupportResistance, buildTechnicalIndicators, buildNewsMessage, buildComingSoon, buildOverview } = require('./flexBuilders');

const app = express();

// ===== ENV =====
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.get('/', (req, res) => {
    res.send('Stock Bot is running 🚀');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        await Promise.all(events.map(handleEvent));
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// ===== Event Router =====
async function handleEvent(event) {
    if (event.type === 'message' && event.message.type === 'text') {
        return handleTextMessage(event);
    }
    if (event.type === 'postback') {
        return handlePostback(event);
    }
    return null;
}

// ===== Text Message Handler =====
async function handleTextMessage(event) {
    const rawText = event.message.text.trim();
    const keyword = rawText.toUpperCase();

    try {
        // ===== ทองคำ =====
        if (keyword === 'GOLD' || rawText === 'ทอง' || rawText === 'ทองคำ' || keyword === 'XAUUSD' || keyword === 'XAU') {
            return await handleGoldMessage(event);
        }

        // ===== หุ้นไทย =====
        if (/^[A-Z]{1,10}$/.test(keyword)) {
            return await handleStockMessage(event, keyword);
        }

        // ข้อความที่ไม่ตรงเงื่อนไข
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '💡 พิมพ์ชื่อหุ้นไทย (เช่น PTT, AOT, ADVANC) หรือพิมพ์ "ทอง" เพื่อดูราคาทองคำ'
        });

    } catch (err) {
        console.error('handleTextMessage fatal error:', err);
        // ถ้า Flex Message ล้มเหลว ตอบด้วย text ธรรมดาแทน
        try {
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: `❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง\n\nError: ${err.message || 'Unknown error'}`
            });
        } catch (e) {
            console.error('Even text reply failed:', e.message);
        }
    }
}

// ===== Gold Handler =====
async function handleGoldMessage(event) {
    let goldData = null;
    let prices = null;

    // ดึงราคาทอง
    try {
        goldData = await fetchGoldQuote();
    } catch (err) {
        console.log('Gold quote failed:', err.message);
    }

    // ดึง time series สำหรับกราฟ
    try {
        prices = await fetchTimeSeries('XAU/USD', { outputsize: 30 });
    } catch (err) {
        console.log('Gold time series failed:', err.message);
    }

    // ถ้าดึงราคาไม่ได้ ใช้ fallback
    if (!goldData) {
        goldData = {
            symbol: 'XAU/USD', name: 'Gold (ทองคำ)', exchange: 'FOREX',
            currency: 'USD', price: 0, change: 0, changePercent: 0,
            high: null, low: null, open: null, volume: null,
            high52: null, low52: null, pe: null, eps: null
        };
    }

    const chartUrl = prices ? generatePriceChartUrl('XAU/USD', prices, 'Gold') : null;

    // ลองส่ง Flex Message
    try {
        return await client.replyMessage(event.replyToken, buildStockCard(goldData, chartUrl));
    } catch (flexErr) {
        console.error('Gold Flex Message failed:', flexErr.message);
        // Fallback เป็น text ธรรมดา
        const changeIcon = goldData.change >= 0 ? '📈' : '📉';
        const text = `${changeIcon} ราคาทองคำ (GOLD)\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 ราคา: $${goldData.price.toFixed(2)} USD/oz\n` +
            `📊 เปลี่ยนแปลง: $${goldData.change.toFixed(2)} (${goldData.changePercent.toFixed(2)}%)\n` +
            (goldData.high ? `📌 สูง-ต่ำ: $${goldData.high.toFixed(2)} - $${goldData.low.toFixed(2)}\n` : '') +
            `━━━━━━━━━━━━━━━━━━`;
        return client.replyMessage(event.replyToken, { type: 'text', text });
    }
}

// ===== Stock Handler =====
async function handleStockMessage(event, keyword) {
    let stockData = null;
    let prices = null;

    // ลอง 1: Twelve Data พร้อม exchange SET
    try {
        stockData = await fetchStockQuote(keyword);
    } catch (err) {
        console.log(`SET quote failed for ${keyword}:`, err.message);
    }

    // ลอง 2: Twelve Data โดยไม่ระบุ exchange
    if (!stockData) {
        try {
            const { fetchStockQuoteNoExchange } = require('./dataFetchers');
            stockData = await fetchStockQuoteNoExchange(keyword);
        } catch (err) {
            console.log(`General quote failed for ${keyword}:`, err.message);
        }
    }

    // ดึง time series สำหรับกราฟ
    try {
        prices = await fetchTimeSeries(keyword, { outputsize: 30, exchange: 'SET' });
    } catch (err) {
        console.log(`Time series failed for ${keyword}:`, err.message);
        try {
            prices = await fetchTimeSeries(keyword, { outputsize: 30 });
        } catch (e) {
            console.log(`Time series (no exchange) failed for ${keyword}:`, e.message);
        }
    }

    // ถ้าดึงราคาไม่ได้เลย ใช้ fallback
    if (!stockData) {
        stockData = {
            symbol: keyword, name: keyword, exchange: 'SET',
            currency: 'THB', price: 0, change: 0, changePercent: 0,
            high: null, low: null, open: null, volume: null,
            high52: null, low52: null, pe: null, eps: null
        };
    }

    const chartUrl = prices ? generatePriceChartUrl(keyword, prices, stockData.name) : null;

    // ลองส่ง Flex Message
    try {
        return await client.replyMessage(event.replyToken, buildStockCard(stockData, chartUrl));
    } catch (flexErr) {
        console.error('Stock Flex Message failed:', flexErr.message);
        // Fallback เป็น text ธรรมดา
        const changeIcon = stockData.change >= 0 ? '📈' : '📉';
        const text = `${changeIcon} หุ้น ${keyword}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 ราคา: ฿${stockData.price.toFixed(2)}\n` +
            `📊 เปลี่ยนแปลง: ${stockData.change.toFixed(2)} (${stockData.changePercent.toFixed(2)}%)\n` +
            (stockData.volume ? `📦 Volume: ${stockData.volume.toLocaleString()}\n` : '') +
            `━━━━━━━━━━━━━━━━━━`;
        return client.replyMessage(event.replyToken, { type: 'text', text });
    }
}

// ===== Postback Handler =====
async function handlePostback(event) {
    const data = parsePostbackData(event.postback.data);
    const { action, symbol, type } = data;

    try {
        switch (action) {
            case 'detail_menu':
                return client.replyMessage(event.replyToken, buildDetailMenu(symbol, type));

            case 'overview':
                return handleOverview(event, symbol, type);

            case 'sr':
                return handleSupportResistance(event, symbol, type);

            case 'technical':
                return handleTechnicalIndicators(event, symbol, type);

            case 'news':
                return handleNews(event, symbol, type);

            case 'dividend':
                return client.replyMessage(event.replyToken, buildComingSoon(symbol, 'เงินปันผล'));

            case 'income':
                return client.replyMessage(event.replyToken, buildComingSoon(symbol, 'งบกำไรขาดทุน'));

            case 'balance':
                return client.replyMessage(event.replyToken, buildComingSoon(symbol, 'งบดุล'));

            case 'cashflow':
                return client.replyMessage(event.replyToken, buildComingSoon(symbol, 'กระแสเงินสด'));

            case 'revenue':
                return client.replyMessage(event.replyToken, buildComingSoon(symbol, 'การแบ่งส่วนรายได้'));

            case 'alert':
                return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: `🔔 ระบบแจ้งเตือนข่าว ${symbol} กำลังพัฒนา\nจะเปิดให้บริการเร็วๆ นี้`
                });

            default:
                return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: '❌ ไม่พบคำสั่งที่ต้องการ'
                });
        }
    } catch (err) {
        console.error(`Postback error (${action}):`, err.message);
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `❌ เกิดข้อผิดพลาดในการดึงข้อมูล ${symbol}\nกรุณาลองใหม่อีกครั้ง`
        });
    }
}

// ===== Postback Action Handlers =====

async function handleOverview(event, symbol, type) {
    const isGold = type === 'gold';
    const data = isGold ? await fetchGoldQuote() : await fetchStockQuote(symbol);
    return client.replyMessage(event.replyToken, buildOverview(data));
}

async function handleSupportResistance(event, symbol, type) {
    const isGold = type === 'gold';
    const options = isGold ? { outputsize: 60 } : { outputsize: 60, exchange: 'SET' };
    const prices = await fetchTimeSeries(isGold ? 'XAU/USD' : symbol, options);
    const srData = calculateSupportResistance(prices);
    const currentPrice = prices[prices.length - 1]?.close;
    const chartUrl = generateSRChartUrl(symbol, prices, srData.supports, srData.resistances);
    return client.replyMessage(event.replyToken, buildSupportResistance(symbol, srData, chartUrl, currentPrice));
}

async function handleTechnicalIndicators(event, symbol, type) {
    const isGold = type === 'gold';
    const exchange = isGold ? null : 'SET';
    const actualSymbol = isGold ? 'XAU/USD' : symbol;
    const indicators = await fetchTechnicalIndicators(actualSymbol, exchange);
    return client.replyMessage(event.replyToken, buildTechnicalIndicators(symbol, indicators));
}

async function handleNews(event, symbol, type) {
    const isGold = type === 'gold';
    const news = await fetchNews(symbol, isGold ? 'gold' : 'stock');
    return client.replyMessage(event.replyToken, buildNewsMessage(symbol, news));
}

// ===== Utils =====

function parsePostbackData(dataStr) {
    const params = {};
    dataStr.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Stock Bot running at port ${port}`);
});
