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
    const keyword = event.message.text.trim().toUpperCase();

    try {
        // ===== ทองคำ =====
        if (keyword === 'GOLD' || keyword === 'ทอง' || keyword === 'XAUUSD' || keyword === 'XAU') {
            const [goldData, prices] = await Promise.all([
                fetchGoldQuote(),
                fetchTimeSeries('XAU/USD', { outputsize: 30 }).catch(() => null)
            ]);

            const chartUrl = prices ? generatePriceChartUrl('XAU/USD', prices, 'Gold') : null;
            const flexMessage = buildStockCard(goldData, chartUrl);

            return client.replyMessage(event.replyToken, flexMessage);
        }

        // ===== หุ้นไทย =====
        if (/^[A-Z]{1,10}$/.test(keyword)) {
            const [stockData, prices] = await Promise.all([
                fetchStockQuote(keyword),
                fetchTimeSeries(keyword, { outputsize: 30, exchange: 'SET' }).catch(() => null)
            ]);

            const chartUrl = prices ? generatePriceChartUrl(keyword, prices, stockData.name) : null;
            const flexMessage = buildStockCard(stockData, chartUrl);

            return client.replyMessage(event.replyToken, flexMessage);
        }

        // ข้อความที่ไม่ตรงเงื่อนไข
        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '💡 พิมพ์ชื่อหุ้นไทย (เช่น PTT, AOT, ADVANC) หรือพิมพ์ "ทอง" เพื่อดูราคาทองคำ'
        });

    } catch (err) {
        console.error('Text handler error:', err.message);

        // ถ้าหาหุ้นไม่เจอ ลองค้นข่าว
        try {
            const news = await fetchNews(keyword);
            if (news.length > 0) {
                return client.replyMessage(event.replyToken, buildNewsMessage(keyword, news));
            }
        } catch (e) { /* ignore */ }

        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `❌ ไม่พบข้อมูลหุ้น "${keyword}"\n\n💡 ลองพิมพ์ชื่อหุ้นไทย เช่น PTT, AOT, ADVANC\nหรือพิมพ์ "ทอง" เพื่อดูราคาทองคำ`
        });
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
