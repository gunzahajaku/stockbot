require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const Parser = require('rss-parser');
const axios = require('axios');

const app = express();
const parser = new Parser();

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ===== คำที่มีผลต่อราคาทอง =====
const goldImpactKeywords = [
    "GOLD",
    "ทอง",
    "FED",
    "ดอกเบี้ย",
    "INFLATION",
    "เงินเฟ้อ",
    "DOLLAR",
    "BOND",
    "YIELD",
    "เศรษฐกิจสหรัฐ"
];

app.get('/', (req, res) => {
    res.send('Gold & Thai Stock Bot running');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
    try {

        const events = req.body.events;

        await Promise.all(events.map(async (event) => {

            if (event.type !== 'message' || event.message.type !== 'text') return;

            const keyword = event.message.text.trim().toUpperCase();
            let replyText = "";

            // =========================
            // ===== ทองคำ =====
            // =========================
            if (keyword === "GOLD" || keyword === "ทอง") {

                let allItems = [];

                try {
                    const thaiGold = await parser.parseURL('https://www.huasengheng.com/feed/');
                    allItems = allItems.concat(thaiGold.items);
                } catch { }

                try {
                    const yahooGold = await parser.parseURL(
                        'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US'
                    );
                    allItems = allItems.concat(yahooGold.items);
                } catch { }

                const filtered = allItems.filter(item => {
                    const text = `${item.title || ""}${item.contentSnippet || ""}`.toUpperCase();
                    return goldImpactKeywords.some(word => text.includes(word));
                });

                const unique = [];
                const seen = new Set();

                for (const item of filtered) {
                    if (!seen.has(item.link)) {
                        seen.add(item.link);
                        unique.push(item);
                    }
                }

                replyText = "🟡 ข่าวทองคำที่อาจมีผลต่อราคา\n\n";

                unique.slice(0, 5).forEach((item, index) => {
                    replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                });

                // ===== กราฟราคาทอง =====
                const chartRes = await axios.get(
                    'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=7d&interval=1d'
                );

                const prices = chartRes.data.chart.result[0].indicators.quote[0].close;

                const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
                    type: 'line',
                    data: {
                        labels: prices.map((_, i) => `Day ${i + 1}`),
                        datasets: [{
                            label: 'Gold Price',
                            data: prices
                        }]
                    }
                }))}`;

                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: replyText.substring(0, 1900) },
                    { type: 'image', originalContentUrl: chartUrl, previewImageUrl: chartUrl }
                ]);
            }

            // =========================
            // ===== หุ้นไทย =====
            // =========================
            else if (/^[A-Z]{2,6}$/.test(keyword)) {

                const symbol = `${keyword}.BK`;

                // ===== ราคา =====
                const priceRes = await axios.get(
                    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
                );

                const quote = priceRes.data.quoteResponse.result[0];

                if (!quote) {
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: `ไม่พบข้อมูลหุ้น ${keyword}`
                    });
                }

                replyText =
                    `📈 ${keyword}\n` +
                    `ราคา: ${quote.regularMarketPrice} บาท\n` +
                    `เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} ` +
                    `(${quote.regularMarketChangePercent.toFixed(2)}%)\n\n`;

                // ===== ข่าวหุ้น =====
                const yahooFeed = await parser.parseURL(
                    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`
                );

                replyText += "📰 ข่าวล่าสุด\n\n";

                yahooFeed.items.slice(0, 3).forEach((item, index) => {
                    replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                });

                // ===== กราฟหุ้น =====
                const chartRes = await axios.get(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=7d&interval=1d`
                );

                const prices = chartRes.data.chart.result[0].indicators.quote[0].close;

                const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
                    type: 'line',
                    data: {
                        labels: prices.map((_, i) => `Day ${i + 1}`),
                        datasets: [{
                            label: keyword,
                            data: prices
                        }]
                    }
                }))}`;

                return client.replyMessage(event.replyToken, [
                    { type: 'text', text: replyText.substring(0, 1900) },
                    { type: 'image', originalContentUrl: chartUrl, previewImageUrl: chartUrl }
                ]);
            }

            // =========================
            // ===== fallback =====
            // =========================
            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'พิมพ์รหัสหุ้นไทย เช่น PTT หรือพิมพ์ GOLD สำหรับข่าวทองคำ'
            });

        }));

        res.sendStatus(200);

    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
