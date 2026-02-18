require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const { fetchStockQuote, fetchStockQuoteNoExchange, fetchGoldQuote, fetchTimeSeries, fetchStockQuoteYahoo, fetchTimeSeriesYahoo, calculateSupportResistance, fetchTechnicalIndicators, fetchFinancialData, fetchNews } = require('./dataFetchers');
const { generatePriceChartUrl, generateSRChartUrl } = require('./chartGenerator');
const { buildStockCard, buildDetailMenu, buildSupportResistance, buildTechnicalIndicators, buildNewsMessage, buildComingSoon, buildOverview, buildDividend, buildIncomeStatement, buildBalanceSheet, buildCashFlow } = require('./flexBuilders');

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
    console.log('[GOLD] Handler started');

    let goldData = null;
    let prices = null;

    // ดึงทั้งราคาและ time series พร้อมกัน (parallel) + timeout สั้นลง
    try {
        const results = await Promise.allSettled([
            fetchGoldQuote(),
            fetchTimeSeries('XAU/USD', { outputsize: 30 })
        ]);

        if (results[0].status === 'fulfilled') {
            goldData = results[0].value;
            console.log('[GOLD] Quote fetched OK, price:', goldData.price);
        } else {
            console.log('[GOLD] Quote failed:', results[0].reason?.message);
        }

        if (results[1].status === 'fulfilled') {
            prices = results[1].value;
            console.log('[GOLD] Time series fetched OK, points:', prices.length);
        } else {
            console.log('[GOLD] Time series failed:', results[1].reason?.message);
        }
    } catch (err) {
        console.log('[GOLD] Promise.allSettled error:', err.message);
    }

    // ถ้าดึงราคาไม่ได้ ใช้ fallback
    if (!goldData) {
        console.log('[GOLD] Using fallback data');
        goldData = {
            symbol: 'XAU/USD', name: 'Gold (ทองคำ)', exchange: 'FOREX',
            currency: 'USD', price: 0, change: 0, changePercent: 0,
            high: null, low: null, open: null, volume: null,
            high52: null, low52: null, pe: null, eps: null
        };
    }

    const chartUrl = prices ? await generatePriceChartUrl('XAU/USD', prices, 'Gold') : null;
    console.log('[GOLD] Chart URL:', chartUrl ? chartUrl : 'null');

    // ลอง Flex Message ก่อน
    try {
        const flexMsg = buildStockCard(goldData, chartUrl);
        console.log('[GOLD] Flex JSON built OK');
        await client.replyMessage(event.replyToken, flexMsg);
        console.log('[GOLD] Flex sent OK');
        return;
    } catch (flexErr) {
        console.error('[GOLD] Flex failed:', flexErr.message);
        if (flexErr.originalError?.response?.data) {
            console.error('[GOLD] LINE API error:', JSON.stringify(flexErr.originalError.response.data));
        }
    }

    // Fallback: text ธรรมดา
    try {
        const changeIcon = goldData.change >= 0 ? '📈' : '📉';
        const text = `${changeIcon} ราคาทองคำ (GOLD)\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 ราคา: $${goldData.price.toFixed(2)} USD/oz\n` +
            `📊 เปลี่ยนแปลง: $${goldData.change.toFixed(2)} (${goldData.changePercent.toFixed(2)}%)\n` +
            `━━━━━━━━━━━━━━━━━━\n\n` +
            `พิมพ์ "GOLD" อีกครั้งเพื่อดูข้อมูลกราฟ`;
        await client.replyMessage(event.replyToken, { type: 'text', text });
        console.log('[GOLD] Text fallback sent OK');
        return;
    } catch (textErr) {
        console.error('[GOLD] Text fallback also failed:', textErr.message);
        // replyToken ถูกใช้ไปแล้ว ไม่สามารถส่งซ้ำได้
    }
}

// ===== Stock Handler =====
async function handleStockMessage(event, keyword) {
    let stockData = null;
    let prices = null;

    // ลอง 1: Twelve Data พร้อม exchange SET
    try {
        stockData = await fetchStockQuote(keyword);
        console.log(`[STOCK] Twelve Data SET OK: ${keyword}`);
    } catch (err) {
        console.log(`[STOCK] Twelve Data SET failed: ${err.message}`);
    }

    // ลอง 2: Twelve Data โดยไม่ระบุ exchange
    if (!stockData) {
        try {
            stockData = await fetchStockQuoteNoExchange(keyword);
            console.log(`[STOCK] Twelve Data (no exchange) OK: ${keyword}`);
        } catch (err) {
            console.log(`[STOCK] Twelve Data (no exchange) failed: ${err.message}`);
        }
    }

    // ลอง 3: Yahoo Finance (.BK) สำหรับหุ้นไทย
    if (!stockData) {
        try {
            stockData = await fetchStockQuoteYahoo(keyword);
            console.log(`[STOCK] Yahoo Finance OK: ${keyword}, price: ${stockData.price}`);
        } catch (err) {
            console.log(`[STOCK] Yahoo Finance failed: ${err.message}`);
        }
    }

    // ดึง time series สำหรับกราฟ
    // ลอง Twelve Data ก่อน → Yahoo Finance
    try {
        prices = await fetchTimeSeries(keyword, { outputsize: 30, exchange: 'SET' });
        console.log(`[STOCK] Time series (Twelve Data SET) OK: ${prices.length} points`);
    } catch (err) {
        console.log(`[STOCK] Time series (Twelve Data SET) failed: ${err.message}`);
        try {
            prices = await fetchTimeSeriesYahoo(keyword, 30);
            console.log(`[STOCK] Time series (Yahoo) OK: ${prices.length} points`);
        } catch (e) {
            console.log(`[STOCK] Time series (Yahoo) failed: ${e.message}`);
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

    const chartUrl = prices ? await generatePriceChartUrl(keyword, prices, stockData.name) : null;

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
                return handleDividend(event, symbol);

            case 'income':
                return handleIncomeStatement(event, symbol);

            case 'balance':
                return handleBalanceSheet(event, symbol);

            case 'cashflow':
                return handleCashFlow(event, symbol);

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
    let data;
    if (isGold) {
        data = await fetchGoldQuote();
    } else {
        try { data = await fetchStockQuote(symbol); }
        catch { try { data = await fetchStockQuoteYahoo(symbol); } catch { data = null; } }
    }
    if (!data) {
        return client.replyMessage(event.replyToken, { type: 'text', text: `❌ ไม่สามารถดึงข้อมูล ${symbol} ได้` });
    }
    return client.replyMessage(event.replyToken, buildOverview(data));
}

async function handleSupportResistance(event, symbol, type) {
    const isGold = type === 'gold';
    let prices;
    if (isGold) {
        prices = await fetchTimeSeries('XAU/USD', { outputsize: 60 });
    } else {
        try { prices = await fetchTimeSeries(symbol, { outputsize: 60, exchange: 'SET' }); }
        catch { prices = await fetchTimeSeriesYahoo(symbol, 60); }
    }
    const srData = calculateSupportResistance(prices);
    const currentPrice = prices[prices.length - 1]?.close;
    const chartUrl = await generateSRChartUrl(symbol, prices, srData.supports, srData.resistances);
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

async function handleDividend(event, symbol) {
    try {
        const fin = await fetchFinancialData(symbol);
        return client.replyMessage(event.replyToken, buildDividend(symbol, fin.dividend));
    } catch (err) {
        console.error(`Dividend error for ${symbol}:`, err.message);
        return client.replyMessage(event.replyToken, { type: 'text', text: `❌ ไม่พบข้อมูลเงินปันผลของ ${symbol}` });
    }
}

async function handleIncomeStatement(event, symbol) {
    try {
        const fin = await fetchFinancialData(symbol);
        if (!fin.incomeStatement) throw new Error('No income statement data');
        return client.replyMessage(event.replyToken, buildIncomeStatement(symbol, fin.incomeStatement));
    } catch (err) {
        console.error(`Income statement error for ${symbol}:`, err.message);
        return client.replyMessage(event.replyToken, { type: 'text', text: `❌ ไม่พบข้อมูลงบกำไรขาดทุนของ ${symbol}` });
    }
}

async function handleBalanceSheet(event, symbol) {
    try {
        const fin = await fetchFinancialData(symbol);
        if (!fin.balanceSheet) throw new Error('No balance sheet data');
        return client.replyMessage(event.replyToken, buildBalanceSheet(symbol, fin.balanceSheet));
    } catch (err) {
        console.error(`Balance sheet error for ${symbol}:`, err.message);
        return client.replyMessage(event.replyToken, { type: 'text', text: `❌ ไม่พบข้อมูลงบดุลของ ${symbol}` });
    }
}

async function handleCashFlow(event, symbol) {
    try {
        const fin = await fetchFinancialData(symbol);
        if (!fin.cashFlow) throw new Error('No cash flow data');
        return client.replyMessage(event.replyToken, buildCashFlow(symbol, fin.cashFlow));
    } catch (err) {
        console.error(`Cash flow error for ${symbol}:`, err.message);
        return client.replyMessage(event.replyToken, { type: 'text', text: `❌ ไม่พบข้อมูลกระแสเงินสดของ ${symbol}` });
    }
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
