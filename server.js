const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ใช้ Environment Variable แทนการใส่ตรง ๆ
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

// หน้า root ไว้ให้ Render เช็คว่าแอพรันอยู่
app.get("/", (req, res) => {
    res.send("Stock Bot is running");
});

app.post("/webhook", async (req, res) => {
    try {
        const events = req.body.events;

        for (let event of events) {
            if (event.type === "message" && event.message.type === "text") {
                const userText = event.message.text.toUpperCase();

                const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${userText}&region=US&lang=en-US`;

                await axios.get(rssUrl); // แค่เช็คว่าดึงได้

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
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port", port);
});
