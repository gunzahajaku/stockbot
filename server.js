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
const ALPHA_VANTAGE_API_KEY = process.env.Alpha_Vantage_API;
const Twelve_Data_API = process.env.Twelve_Data_API;

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

                // ราคาทอง (XAU/USD) จาก Twelve Data
                try {
                    const priceRes = await axios.get(
                        `https://api.twelvedata.com/quote`,
                        {
                            params: {
                                symbol: 'XAU/USD',
                                apikey: Twelve_Data_API
                            },
                            timeout: 8000
                        }
                    );

                    if (priceRes.data && priceRes.data.close) {
                        const data = priceRes.data;
                        const currentPrice = parseFloat(data.close);
                        const change = parseFloat(data.change || 0);
                        const changePercent = parseFloat(data.percent_change || 0);

                        const changeSymbol = change >= 0 ? '📈' : '📉';
                        const changeColor = change >= 0 ? '🟢' : '🔴';

                        priceText =
                            `${changeSymbol} ราคาทองคำ (GOLD) ${changeColor}\n` +
                            `━━━━━━━━━━━━━━━━━━\n` +
                            `💰 ราคาปัจจุบัน: $${currentPrice.toFixed(2)} USD/oz\n` +
                            `📊 เปลี่ยนแปลง: $${change.toFixed(2)} (${changePercent.toFixed(2)}%)\n`;

                        if (data.high && data.low) {
                            priceText += `📌 สูง-ต่ำ: $${parseFloat(data.high).toFixed(2)} - $${parseFloat(data.low).toFixed(2)}\n`;
                        }

                        priceText += `━━━━━━━━━━━━━━━━━━\n\n`;
                    }

                } catch (err) {
                    console.log('ไม่สามารถดึงราคาทอง:', err.message);
                    if (err.response?.data) {
                        console.log('Twelve Data error:', err.response.data);
                    }
                    priceText = "❌ ไม่สามารถดึงราคาทองได้\n\n";
                }

                // ข่าวทอง
                try {
                    const feed = await parser.parseURL('https://www.huasengheng.com/feed/');
                    replyText = priceText + "📰 ข่าวทองคำล่าสุด\n\n";

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
                        // Twelve Data API สำหรับหุ้นไทย
                        const priceRes = await axios.get(
                            `https://api.twelvedata.com/quote`,
                            {
                                params: {
                                    symbol: keyword,
                                    exchange: 'SET',  // Stock Exchange of Thailand
                                    apikey: Twelve_Data_API
                                },
                                timeout: 8000
                            }
                        );

                        if (priceRes.data && priceRes.data.close) {
                            const data = priceRes.data;
                            const currentPrice = parseFloat(data.close);
                            const change = parseFloat(data.change || 0);
                            const changePercent = parseFloat(data.percent_change || 0);

                            const changeSymbol = change >= 0 ? '📈' : '📉';
                            const changeColor = change >= 0 ? '🟢' : '🔴';

                            priceText =
                                `${changeSymbol} หุ้น ${keyword} ${changeColor}\n` +
                                `━━━━━━━━━━━━━━━━━━\n` +
                                `💰 ราคาปัจจุบัน: ${currentPrice.toFixed(2)} บาท\n` +
                                `📊 เปลี่ยนแปลง: ${change.toFixed(2)} (${changePercent.toFixed(2)}%)\n`;

                            if (data.high && data.low) {
                                priceText += `📌 สูง-ต่ำ: ${parseFloat(data.high).toFixed(2)} - ${parseFloat(data.low).toFixed(2)}\n`;
                            }
                            if (data.volume) {
                                priceText += `📦 ปริมาณ: ${parseInt(data.volume).toLocaleString()}\n`;
                            }

                            priceText += `━━━━━━━━━━━━━━━━━━\n\n`;
                        }
                    } catch (err) {
                        console.log('ไม่สามารถดึงราคาหุ้น:', err.message);
                        if (err.response?.data) {
                            console.log('Twelve Data error:', err.response.data);
                        }
                    }
                }


                // ===== แสดงผล =====
                if (unique.length === 0) {
                    replyText = priceText + `ไม่พบข่าวของ ${keyword}`;
                } else {
                    replyText = priceText + ` ข่าวเกี่ยวกับ ${keyword}\n\n`;

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
