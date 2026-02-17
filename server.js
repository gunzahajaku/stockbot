const express = require("express");
const axios = require("axios");
const Parser = require("rss-parser");

const app = express();
app.use(express.json());

const parser = new Parser();
const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;

// หน้า root
app.get("/", (req, res) => {
    res.send("Stock Bot is running");
});

app.post("/webhook", async (req, res) => {
    try {
        const events = req.body.events;

        for (let event of events) {
            if (event.type === "message" && event.message.type === "text") {

                const userText = event.message.text.toUpperCase().trim();
                let rssUrl = "";
                let title = "";

                // ===== ทองคำ =====
                if (userText === "GOLD" || userText === "ทอง") {
                    rssUrl = "https://www.kitco.com/rss/news";
                    title = "ข่าวทองคำล่าสุด";
                }

                // ===== หุ้นไทย =====
                else if (/^[A-Z]{2,5}$/.test(userText)) {
                    rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${userText}.BK&region=US&lang=en-US`;
                    title = `ข่าวหุ้นไทย ${userText}`;
                }

                // ===== หุ้นต่างประเทศ =====
                else {
                    rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${userText}&region=US&lang=en-US`;
                    title = `ข่าวหุ้น ${userText}`;
                }

                const feed = await parser.parseURL(rssUrl);

                let replyText = `ไม่พบข่าวของ ${userText}`;

                if (feed.items && feed.items.length > 0) {
                    replyText = `${title}\n\n`;

                    const newsList = feed.items.slice(0, 3);

                    newsList.forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n${item.link}\n\n`;
                    });
                }

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
        console.error(error.message);
        res.sendStatus(500);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port", port);
});
