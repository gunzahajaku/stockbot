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

            const keywordRaw = event.message.text.trim();
            const keyword = keywordRaw.toUpperCase();
            let replyText = "";

            // ===== คำที่บ่งบอกว่าเป็นข่าวตลาดหุ้น =====
            const stockWords = [
                "หุ้น", "ตลาด", "SET", "กำไร", "ขาดทุน",
                "งบ", "ไตรมาส", "ราคาปิด", "ปันผล",
                "นักลงทุน", "ดัชนี"
            ];

            // ===== คำที่บ่งบอกว่าเป็นข่าวทองคำ =====
            const goldWords = [
                "ทอง", "ทองคำ", "ราคาทอง",
                "บาททองคำ", "ฮั่วเซ่งเฮง"
            ];

            // ================== ทองคำ ==================
            if (keyword === "GOLD" || keyword === "ทอง") {

                const feeds = [
                    'https://www.huasengheng.com/feed/',
                    'https://www.kaohoon.com/feed'
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

                const filtered = allItems.filter(item => {
                    const text = (
                        (item.title || "") +
                        (item.contentSnippet || "")
                    );

                    const hasGoldContext = goldWords.some(word =>
                        text.includes(word)
                    );

                    return hasGoldContext;
                });

                if (filtered.length === 0) {
                    replyText = "ไม่พบข่าวทองคำล่าสุด";
                } else {
                    replyText = "🟡 ข่าวทองคำล่าสุด\n\n";
                    filtered.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                    });
                }

            } else {

                // ================== หุ้นไทย ==================
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

                // ===== GNews (เฉพาะภาษาไทย) =====
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

                const filtered = allItems.filter(item => {

                    const text = (
                        (item.title || "") +
                        (item.contentSnippet || "")
                    );

                    const upperText = text.toUpperCase();

                    const hasKeyword = upperText.includes(keyword);

                    const hasStockContext = stockWords.some(word =>
                        text.includes(word)
                    );

                    return hasKeyword && hasStockContext;
                });

                // ===== ตัดข่าวซ้ำ =====
                const unique = [];
                const seen = new Set();

                for (const item of filtered) {
                    if (!seen.has(item.link)) {
                        seen.add(item.link);
                        unique.push(item);
                    }
                }

                if (unique.length === 0) {
                    replyText = `ไม่พบข่าวหุ้นของ ${keyword}`;
                } else {
                    replyText = `📈 ข่าวหุ้นเกี่ยวกับ ${keyword}\n\n`;

                    unique.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
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
