require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const Parser = require('rss-parser');

const app = express();
const parser = new Parser();

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ===== คำที่มีผลกระทบทอง =====
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

            if (event.type !== 'message' || event.message.type !== 'text') {
                return null;
            }

            const keyword = event.message.text.trim().toUpperCase();
            let replyText = "";

            // =========================
            // ===== ทองคำ =====
            // =========================
            if (keyword === "GOLD" || keyword === "ทอง") {

                let allItems = [];

                try {
                    // ฮั่วเซ่งเฮง (ข่าวทองไทย)
                    const thaiGold = await parser.parseURL('https://www.huasengheng.com/feed/');
                    allItems = allItems.concat(thaiGold.items);
                } catch (err) {
                    console.log("Thai gold feed error");
                }

                try {
                    // Yahoo Finance ทองคำโลก
                    const yahooGold = await parser.parseURL(
                        'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US'
                    );
                    allItems = allItems.concat(yahooGold.items);
                } catch (err) {
                    console.log("Yahoo gold error");
                }

                // ===== กรองข่าวที่มีผลกระทบ =====
                const filtered = allItems.filter(item => {
                    const text = `${item.title || ""}${item.contentSnippet || ""}`.toUpperCase();
                    return goldImpactKeywords.some(word => text.includes(word));
                });

                // ลบข่าวซ้ำ
                const unique = [];
                const seen = new Set();

                for (const item of filtered) {
                    if (!seen.has(item.link)) {
                        seen.add(item.link);
                        unique.push(item);
                    }
                }

                if (unique.length === 0) {
                    replyText = "ไม่พบข่าวทองคำที่มีผลกระทบต่อราคาในขณะนี้";
                } else {
                    replyText = "🟡 ข่าวทองคำที่อาจมีผลต่อราคาขึ้น/ลง\n\n";

                    unique.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                    });
                }
            }

            // =========================
            // ===== หุ้นไทย (Yahoo) =====
            // =========================
            else if (/^[A-Z]{2,6}$/.test(keyword)) {

                try {

                    const yahooFeed = await parser.parseURL(
                        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${keyword}.BK&region=US&lang=en-US`
                    );

                    if (!yahooFeed.items || yahooFeed.items.length === 0) {
                        replyText = `ไม่พบข่าวของหุ้น ${keyword}`;
                    } else {

                        replyText = `📈 ข่าวของหุ้น ${keyword}\n\n`;

                        yahooFeed.items.slice(0, 5).forEach((item, index) => {
                            replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                        });
                    }

                } catch (err) {
                    replyText = `เกิดข้อผิดพลาดในการดึงข่าว ${keyword}`;
                }
            }

            else {
                replyText = "พิมพ์รหัสหุ้นไทย เช่น PTT หรือพิมพ์ GOLD สำหรับข่าวทองคำ";
            }

            // กันข้อความยาวเกิน
            if (replyText.length > 1900) {
                replyText = replyText.substring(0, 1900) + "\n\n(ข้อความถูกตัดเนื่องจากยาวเกินไป)";
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
