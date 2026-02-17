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

app.get('/', (req, res) => {
    res.send('Thai Stock Yahoo Bot running');
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

            // รับเฉพาะรหัสหุ้น 2-6 ตัวอักษร
            if (!/^[A-Z]{2,6}$/.test(keyword)) {
                replyText = "กรุณาพิมพ์รหัสหุ้นไทย เช่น PTT, AOT, AS";
            } else {

                try {

                    // ดึงเฉพาะหุ้นไทย (.BK)
                    const yahooFeed = await parser.parseURL(
                        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${keyword}.BK&region=US&lang=en-US`
                    );

                    if (!yahooFeed.items || yahooFeed.items.length === 0) {
                        replyText = `ไม่พบข่าวของหุ้น ${keyword} ใน Yahoo Finance`;
                    } else {

                        replyText = `📈 ข่าวของหุ้น ${keyword} (Yahoo Finance)\n\n`;

                        yahooFeed.items.slice(0, 5).forEach((item, index) => {
                            replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                        });
                    }

                } catch (err) {
                    console.log("Yahoo error:", err.message);
                    replyText = `เกิดข้อผิดพลาดในการดึงข่าว ${keyword}`;
                }
            }

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
