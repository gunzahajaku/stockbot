const express = require('express');
const line = require('@line/bot-sdk');
const Parser = require('rss-parser');

const app = express();
const parser = new Parser();

// ===== ใช้ Environment Variables =====
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ===== หน้า root กัน 404 =====
app.get('/', (req, res) => {
    res.send('Stock Bot is running');
});

// ===== webhook =====
app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;

        await Promise.all(events.map(async (event) => {

            if (event.type !== 'message' || event.message.type !== 'text') {
                return null;
            }

            const keyword = event.message.text.trim().toUpperCase();
            let replyText = "";
            let feed;

            // ===== ทองคำ =====
            if (keyword === "GOLD" || keyword === "ทอง") {

                feed = await parser.parseURL('https://www.huasengheng.com/feed/');
                replyText = "🟡 ข่าวทองคำล่าสุด\n\n";

                feed.items.slice(0, 3).forEach((item, index) => {
                    replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                });

            } else {

                // ===== หุ้นไทย =====
                feed = await parser.parseURL('https://www.kaohoon.com/feed');

                const filtered = feed.items.filter(item =>
                    item.title.toUpperCase().includes(keyword)
                );

                if (filtered.length === 0) {
                    replyText = `ไม่พบข่าวของ ${keyword}`;
                } else {
                    replyText = `📈 ข่าวเกี่ยวกับ ${keyword}\n\n`;

                    filtered.slice(0, 3).forEach((item, index) => {
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

// ===== เปิด server =====
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
