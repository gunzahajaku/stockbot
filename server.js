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
                } catch (err) {
                    console.log('ไม่สามารถดึงข่าวทองไทย:', err.message);
                }

                // ข่าวทองโลก
                try {
                    const yahooGold = await parser.parseURL(
                        'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F&region=US&lang=en-US'
                    );
                    allItems = allItems.concat(yahooGold.items);
                } catch (err) {
                    console.log('ไม่สามารถดึงข่าวทองโลก:', err.message);
                }

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

                    // สร้างข้อความแสดงราคาทองคำ
                    const changeSymbol = quote.regularMarketChange >= 0 ? '📈' : '📉';
                    const changeColor = quote.regularMarketChange >= 0 ? '🟢' : '🔴';

                    priceText =
                        `${changeSymbol} ราคาทองคำ (GOLD) ${changeColor}\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `💰 ราคาปัจจุบัน: $${quote.regularMarketPrice.toFixed(2)} USD\n` +
                        `📊 เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n`;

                    // เพิ่มข้อมูลเพิ่มเติม
                    if (quote.regularMarketDayHigh && quote.regularMarketDayLow) {
                        priceText += `📌 สูงสุด-ต่ำสุดวันนี้: $${quote.regularMarketDayHigh.toFixed(2)} - $${quote.regularMarketDayLow.toFixed(2)}\n`;
                    }
                    if (quote.regularMarketVolume) {
                        priceText += `📦 ปริมาณซื้อขาย: ${quote.regularMarketVolume.toLocaleString()}\n`;
                    }

                    priceText += `━━━━━━━━━━━━━━━━━━\n\n`;

                    // สร้างกราฟทองคำ
                    const chartRes = await axios.get(
                        'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=7d&interval=1d'
                    );

                    if (chartRes.data.chart.result && chartRes.data.chart.result[0]) {
                        const chartData = chartRes.data.chart.result[0];
                        const timestamps = chartData.timestamp;
                        const prices = chartData.indicators.quote[0].close;

                        // สร้างป้ายกำกับวันที่
                        const labels = timestamps.map(ts => {
                            const date = new Date(ts * 1000);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                        });

                        chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
                            type: 'line',
                            data: {
                                labels: labels,
                                datasets: [{
                                    label: 'Gold (USD)',
                                    data: prices,
                                    borderColor: 'rgb(255, 193, 7)',
                                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                    borderWidth: 3,
                                    fill: true,
                                    tension: 0.4
                                }]
                            },
                            options: {
                                title: {
                                    display: true,
                                    text: 'กราฟราคาทองคำ (7 วันล่าสุด)',
                                    fontSize: 18,
                                    fontColor: '#333'
                                },
                                scales: {
                                    yAxes: [{
                                        ticks: {
                                            callback: function (value) {
                                                return '$' + value.toFixed(2);
                                            }
                                        }
                                    }]
                                },
                                plugins: {
                                    legend: {
                                        display: true
                                    }
                                }
                            }
                        }))}&width=800&height=400&backgroundColor=white`;
                    }

                } catch (err) {
                    console.log('ไม่สามารถดึงข้อมูลราคาทอง:', err.message);
                    priceText = "❌ ไม่สามารถดึงข้อมูลราคาทองคำได้\n\n";
                }

                // สร้างข้อความข่าว
                if (unique.length === 0) {
                    replyText = priceText + "📰 ไม่พบข่าวทองคำที่มีผลกระทบในขณะนี้";
                } else {
                    replyText = priceText + "📰 ข่าวที่อาจกระทบราคาทอง:\n\n";
                    unique.slice(0, 5).forEach((item, index) => {
                        replyText += `${index + 1}. ${item.title}\n🔗 ${item.link}\n\n`;
                    });
                }

                // จำกัดความยาวข้อความ
                if (replyText.length > 1900) {
                    replyText = replyText.substring(0, 1900) + '...';
                }

                // ส่งข้อความและกราฟ
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

                    // ราคาหุ้น
                    const priceRes = await axios.get(
                        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`
                    );

                    // ตรวจสอบว่ามีผลลัพธ์หรือไม่
                    if (!priceRes.data.quoteResponse.result || priceRes.data.quoteResponse.result.length === 0) {
                        return client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: `❌ ไม่พบข้อมูลหุ้น ${keyword} ในตลาดหลักทรัพย์ไทย\n\nกรุณาตรวจสอบรหัสหุ้นอีกครั้ง หรือลองใช้รหัสหุ้นอื่น`
                        });
                    }

                    const quote = priceRes.data.quoteResponse.result[0];

                    if (!quote || !quote.regularMarketPrice) {
                        return client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: `❌ ไม่สามารถดึงข้อมูลราคาหุ้น ${keyword} ได้`
                        });
                    }

                    // สร้างข้อความแสดงราคา
                    const changeSymbol = quote.regularMarketChange >= 0 ? '📈' : '📉';
                    const changeColor = quote.regularMarketChange >= 0 ? '🟢' : '🔴';

                    replyText =
                        `${changeSymbol} หุ้น ${keyword} ${changeColor}\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `💰 ราคาปัจจุบัน: ${quote.regularMarketPrice.toFixed(2)} บาท\n` +
                        `📊 เปลี่ยนแปลง: ${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)\n`;

                    // เพิ่มข้อมูลเพิ่มเติมถ้ามี
                    if (quote.regularMarketVolume) {
                        replyText += `📦 ปริมาณซื้อขาย: ${quote.regularMarketVolume.toLocaleString()}\n`;
                    }
                    if (quote.regularMarketDayHigh && quote.regularMarketDayLow) {
                        replyText += `📌 สูงสุด-ต่ำสุดวันนี้: ${quote.regularMarketDayHigh.toFixed(2)} - ${quote.regularMarketDayLow.toFixed(2)}\n`;
                    }

                    replyText += `━━━━━━━━━━━━━━━━━━\n\n`;

                    // ข่าวหุ้น
                    let newsFound = false;
                    try {
                        const yahooFeed = await parser.parseURL(
                            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US`
                        );

                        if (yahooFeed.items && yahooFeed.items.length > 0) {
                            replyText += "📰 ข่าวล่าสุด:\n\n";
                            yahooFeed.items.slice(0, 3).forEach((item, index) => {
                                replyText += `${index + 1}. ${item.title}\n🔗 ${item.link}\n\n`;
                            });
                            newsFound = true;
                        }
                    } catch (err) {
                        console.log(`ไม่สามารถดึงข่าวสำหรับ ${symbol}:`, err.message);
                    }

                    if (!newsFound) {
                        replyText += "📰 ไม่พบข่าวล่าสุดสำหรับหุ้นนี้\n\n";
                    }

                    // ดึงข้อมูลกราฟ 7 วัน
                    let chartUrl = null;
                    try {
                        const chartRes = await axios.get(
                            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=7d&interval=1d`
                        );

                        if (chartRes.data.chart.result && chartRes.data.chart.result[0]) {
                            const chartData = chartRes.data.chart.result[0];
                            const timestamps = chartData.timestamp;
                            const prices = chartData.indicators.quote[0].close;

                            // สร้างป้ายกำกับวันที่
                            const labels = timestamps.map(ts => {
                                const date = new Date(ts * 1000);
                                return `${date.getDate()}/${date.getMonth() + 1}`;
                            });

                            // สร้างกราฟที่สวยงามขึ้น
                            chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
                                type: 'line',
                                data: {
                                    labels: labels,
                                    datasets: [{
                                        label: `${keyword} (฿)`,
                                        data: prices,
                                        borderColor: quote.regularMarketChange >= 0 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)',
                                        backgroundColor: quote.regularMarketChange >= 0 ? 'rgba(75, 192, 192, 0.1)' : 'rgba(255, 99, 132, 0.1)',
                                        borderWidth: 3,
                                        fill: true,
                                        tension: 0.4
                                    }]
                                },
                                options: {
                                    title: {
                                        display: true,
                                        text: `กราฟราคาหุ้น ${keyword} (7 วันล่าสุด)`,
                                        fontSize: 18,
                                        fontColor: '#333'
                                    },
                                    scales: {
                                        yAxes: [{
                                            ticks: {
                                                callback: function (value) {
                                                    return value.toFixed(2) + ' ฿';
                                                }
                                            }
                                        }]
                                    },
                                    plugins: {
                                        legend: {
                                            display: true
                                        }
                                    }
                                }
                            }))}&width=800&height=400&backgroundColor=white`;
                        }
                    } catch (err) {
                        console.log(`ไม่สามารถสร้างกราฟสำหรับ ${symbol}:`, err.message);
                    }

                    // จำกัดความยาวข้อความ
                    if (replyText.length > 1900) {
                        replyText = replyText.substring(0, 1900) + '...';
                    }

                    // ส่งข้อความและกราฟ
                    if (chartUrl) {
                        return client.replyMessage(event.replyToken, [
                            { type: 'text', text: replyText },
                            { type: 'image', originalContentUrl: chartUrl, previewImageUrl: chartUrl }
                        ]);
                    } else {
                        return client.replyMessage(event.replyToken, {
                            type: 'text',
                            text: replyText
                        });
                    }

                } catch (err) {
                    console.error('Error fetching stock data:', err);
                    return client.replyMessage(event.replyToken, {
                        type: 'text',
                        text: `❌ เกิดข้อผิดพลาดในการดึงข้อมูลหุ้น ${keyword}\n\nกรุณาลองใหม่อีกครั้ง`
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
