require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const Parser = require('rss-parser');
const axios = require('axios');

const app = express();
const parser = new Parser();

// ===== ENV =====
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};

const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

const client = new line.Client(config);

app.get('/', (req, res) => {
    res.send('Stock Bot is running');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;

        await Promise.all(events.map(async (event) => {

            if (event.type !== 'message' || event.message.type !== 'text') {
                return null;
            }

            const keyword = event.message.text.trim().toUpperCase();
            let replyText = "";

            // ===== ทองคำ =====
            if (keyword === "GOLD" || keyword === "ทอง") {

                let priceText = "";

                // ราคาทอง
                try {
                    const priceRes = await axios.get(
                        'https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F',
                        { timeout: 5000 }
                    );
                    const quote = priceRes.data.quoteResponse.result[0];

                    const changeSymbol = quote.regularMarketChange >= 0 ? '📈' : '📉';
                    const changeColor = quote.regularMarketChange >= 0 ? '🟢' : '🔴';

                    priceText =
                        `${changeSymbol} ราคาทองคำ (GOLD) ${changeColor}\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `💰 ราคาปัจจุบัน: $${quote.regularMarketPrice.toFixed(2)}\n` +
                        `📊 เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n`;

                    if (quote.regularMarketDayHigh && quote.regularMarketDayLow) {
                        priceText += `📌 สูง-ต่ำ: $${quote.regularMarketDayHigh.toFixed(2)} - $${quote.regularMarketDayLow.toFixed(2)}\n`;
                    }

                    priceText += `━━━━━━━━━━━━━━━━━━\n\n`;

                } catch (err) {
                    console.log('ไม่สามารถดึงราคาทอง:', err.message);
                    priceText = "❌ ไม่สามารถดึงราคาทองได้\n\n";
                }

                // ข่าวทอง
                try {
                    const feed = await parser.parseURL('https://www.huasengheng.com/feed/');
                    replyText = priceText + "� ข่าวทองคำล่าสุด\n\n";

                    feed.items.slice(0, 3).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n🔗 ${item.link}\n\n`;
                    });
                } catch (err) {
                    replyText = priceText + "📰 ไม่สามารถดึงข่าวทองได้";
                }

            } else {

                // ===== RSS ไทย =====
                const feeds = [
                    'https://www.kaohoon.com/feed',
                    'https://www.bangkokbiznews.com/rss',
                    'https://www.thansettakij.com/rss',
                    'https://www.prachachat.net/feed'
                ];

                let allItems = [];

                for (const url of feeds) {
                    try {
                        const feed = await parser.parseURL(url);
                        allItems = allItems.concat(feed.items);
                    } catch (err) {
                        console.log("โหลด feed ไม่ได้:", url);
                    }
                }

                // ===== Yahoo Finance RSS =====
                try {
                    const yahooFeed = await parser.parseURL(
                        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${keyword}.BK&region=US&lang=en-US`
                    );
                    allItems = allItems.concat(yahooFeed.items);
                } catch (err) {
                    console.log("Yahoo feed error");
                }

                // ===== GNews API (ฟรี) =====
                if (GNEWS_API_KEY) {
                    try {
                        const gnews = await axios.get(
                            `https://gnews.io/api/v4/search?q=${keyword}&lang=th&max=5&token=${GNEWS_API_KEY}`
                        );

                        const articles = gnews.data.articles.map(article => ({
                            title: article.title,
                            link: article.url,
                            contentSnippet: article.description || ""
                        }));

                        allItems = allItems.concat(articles);

                    } catch (err) {
                        console.log("GNews error");
                    }
                }

                // ===== Filter =====
                const filtered = allItems.filter(item => {
                    const text = (
                        (item.title || "") +
                        (item.contentSnippet || "")
                    ).toUpperCase();

                    return text.includes(keyword);
                });

                // ===== ตัดข่าวซ้ำ (ตาม link) =====
                const unique = [];
                const seen = new Set();

                for (const item of filtered) {
                    if (!seen.has(item.link)) {
                        seen.add(item.link);
                        unique.push(item);
                    }
                }

                // ===== ราคาหุ้นไทย =====
                let priceText = "";

                if (/^[A-Z]{2,6}$/.test(keyword)) {
                    try {
                        const symbol = `${keyword}.BK`;
                        const priceRes = await axios.get(
                            `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
                            { timeout: 5000 }
                        );

                        if (priceRes.data.quoteResponse.result && priceRes.data.quoteResponse.result.length > 0) {
                            const quote = priceRes.data.quoteResponse.result[0];

                            if (quote && quote.regularMarketPrice) {
                                const changeSymbol = quote.regularMarketChange >= 0 ? '📈' : '📉';
                                const changeColor = quote.regularMarketChange >= 0 ? '🟢' : '🔴';

                                priceText =
                                    `${changeSymbol} หุ้น ${keyword} ${changeColor}\n` +
                                    `━━━━━━━━━━━━━━━━━━\n` +
                                    `💰 ราคาปัจจุบัน: ${quote.regularMarketPrice.toFixed(2)} บาท\n` +
                                    `📊 เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n`;

                                if (quote.regularMarketVolume) {
                                    priceText += `📦 ปริมาณ: ${quote.regularMarketVolume.toLocaleString()}\n`;
                                }
                                if (quote.regularMarketDayHigh && quote.regularMarketDayLow) {
                                    priceText += `📌 สูง-ต่ำ: ${quote.regularMarketDayHigh.toFixed(2)} - ${quote.regularMarketDayLow.toFixed(2)}\n`;
                                }

                                priceText += `━━━━━━━━━━━━━━━━━━\n\n`;
                            }
                        }
                    } catch (err) {
                        console.log('ไม่สามารถดึงราคาหุ้น:', err.message);
                    }
                }

                // ===== แสดงผล =====
                if (unique.length === 0) {
                    replyText = priceText + `ไม่พบข่าวของ ${keyword}`;
                } else {
                    replyText = priceText + `� ข่าวเกี่ยวกับ ${keyword}\n\n`;

                    unique.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n🔗 ${item.link}\n\n`;
                    });
                }
            }

            return client.replyMessage(event.replyToken, {
                type: 'text',
                text: replyText
            });

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
