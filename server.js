const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const CHANNEL_ACCESS_TOKEN = "ใส่ของตัวเองตรงนี้";

app.post("/webhook", async (req, res) => {
    const events = req.body.events;

    for (let event of events) {
        if (event.type === "message" && event.message.type === "text") {
            const userText = event.message.text.toUpperCase();

            // ดึงข่าวจาก Yahoo RSS
            const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${userText}&region=US&lang=en-US`;
            const news = await axios.get(rssUrl);

            const replyText = `ข่าวล่าสุดของ ${userText}\n(ดูรายละเอียดใน Yahoo Finance)`;

            await axios.post(
                "https://api.line.me/v2/bot/message/reply",
                {
                    replyToken: event.replyToken,
                    messages: [{ type: "text", text: replyText }]
                },
                {
                    headers: {
                        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                }
            );
        }
    }

    res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);
