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

// ===== คำที่มีผลกระทบต่อทอง =====
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

                // ข่าวทองไทย
                try {
                    const thaiGold = await parser.parseURL('https://www.huasengheng.com/feed/');
                    allItems = allItems.concat(thaiGold.items);
                } catch (err) { }

                // ข่าวทองโลก
                try {
                    const yahooGold = await parser.parseURL(
                        'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US'
                    );
                    allItems = allItems.concat(yahooGold.items);
                } catch (err) { }

                // กรองข่าวที่มีผลกระทบ
                const filtered = allItems.filter(item => {
                    const text = `${item.title || ""}${item.contentSnippet || ""}`.toUpperCase();
                    return goldImpactKeywords.some(word => text.includes(word));
                });

                // ตัดข่าวซ้ำ
                const unique = [];
                const seen = new Set();
                for (const item of filtered) {
                    if (!seen.has(item.link)) {
                        seen.add(item.link);
                        unique.push(item);
                    }
                }

                // ราคาทอง + กราฟ
                let priceText = "";
                let chartUrl = null;

                try {
                    const priceRes = await axios.get(
                        'https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F'
                    );
                    const quote = priceRes.data.quoteResponse.result[0];

                    priceText =
                        `🟡 GOLD\n` +
                        `ราคา: ${quote.regularMarketPrice} USD\n` +
                        `เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n\n`;

                    const chartRes = await axios.get(
                        'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=7d&interval=1d'
                    );

                    const prices = chartRes.data.chart.result[0].indicators.quote[0].close;

                    chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
                        type: 'line',
                        data: {
                            labels: prices.map((_, i) => `Day ${i + 1}`),
                            datasets: [{
                                label: 'Gold',
                                data: prices
                            }]
                        }
                    }))}`;

                } catch (err) { }

                if (unique.length === 0) {
                    replyText = priceText + "ไม่พบข่าวทองคำที่มีผลกระทบในขณะนี้";
                } else {
                    replyText = priceText + "📰 ข่าวที่อาจกระทบราคาทอง\n\n";
                    unique.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                    });
                }

                if (replyText.length > 1900) replyText = replyText.substring(0, 1900);

                if (chartUrl) {
                    return client.replyMessage(event.replyToken, [
                        { type: 'text', text: replyText },
                        { type: 'image', originalContentUrl: chartUrl, previewImageUrl: chartUrl }
                    ]);
                }

                return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
            }

            // =========================
            // ===== หุ้นไทย =====
            // =========================
            else if (/^[A-Z]{2,6}$/.test(keyword)) {

                try {

                    const symbol = `${keyword}.BK`;

                    // ราคา
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
                        `เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n\n`;

                    // ข่าวหุ้น
                    try {
                        const yahooFeed = await parser.parseURL(
                            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`
                        );

                        replyText += "📰 ข่าวล่าสุด\n\n";
                        yahooFeed.items.slice(0, 3).forEach((item, index) => {
                            replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                        });
                    } catch (err) {
                        replyText += "ไม่สามารถดึงข่าวได้\n\n";
                    }

                    // กราฟ
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

                    if (replyText.length > 1900) replyText = replyText.substring(0, 1900);

                    return client.replyMessage(event.replyToken, [
                        { type: 'text', text: replyText },
                        { type: 'image', originalContentUrl: chartUrl, previewImageUrl: chartUrl }
                    ]);

                } catch (err) {
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: `เกิดข้อผิดพลาดในการดึงข้อมูล ${keyword}`
                    });
                }
            }

            // =========================
            // ===== อื่น ๆ =====
            // =========================
            else {
                return client.replyMessage(event.replyToken, {
                    type: 'text',
                    text: "พิมพ์รหัสหุ้นไทย เช่น PTT หรือพิมพ์ GOLD สำหรับทองคำ"
                });
            }

        }));

        res.sendStatus(200);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
