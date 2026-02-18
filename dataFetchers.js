/**
 * Data Fetchers - ดึงข้อมูลหุ้นไทย/ทองคำจาก API ต่างๆ
 */

const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

const Twelve_Data_API = process.env.Twelve_Data_API;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

// ===== Stock Quote (SET) =====
async function fetchStockQuote(symbol) {
    const res = await axios.get('https://api.twelvedata.com/quote', {
        params: { symbol, exchange: 'SET', apikey: Twelve_Data_API },
        timeout: 8000
    });
    if (res.data && res.data.close) {
        const d = res.data;
        return {
            symbol: d.symbol || symbol,
            name: d.name || symbol,
            exchange: d.exchange || 'SET',
            currency: d.currency || 'THB',
            price: parseFloat(d.close),
            change: parseFloat(d.change || 0),
            changePercent: parseFloat(d.percent_change || 0),
            high: d.high ? parseFloat(d.high) : null,
            low: d.low ? parseFloat(d.low) : null,
            open: d.open ? parseFloat(d.open) : null,
            volume: d.volume ? parseInt(d.volume) : null,
            high52: d.fifty_two_week?.high ? parseFloat(d.fifty_two_week.high) : null,
            low52: d.fifty_two_week?.low ? parseFloat(d.fifty_two_week.low) : null,
            pe: d.pe_ratio ? parseFloat(d.pe_ratio) : null,
            eps: d.eps ? parseFloat(d.eps) : null,
            datetime: d.datetime || ''
        };
    }
    throw new Error('No data from Twelve Data');
}

// ===== Stock Quote (ไม่ระบุ exchange - fallback) =====
async function fetchStockQuoteNoExchange(symbol) {
    const res = await axios.get('https://api.twelvedata.com/quote', {
        params: { symbol, apikey: Twelve_Data_API },
        timeout: 8000
    });
    if (res.data && res.data.close) {
        const d = res.data;
        return {
            symbol: d.symbol || symbol,
            name: d.name || symbol,
            exchange: d.exchange || '',
            currency: d.currency || 'THB',
            price: parseFloat(d.close),
            change: parseFloat(d.change || 0),
            changePercent: parseFloat(d.percent_change || 0),
            high: d.high ? parseFloat(d.high) : null,
            low: d.low ? parseFloat(d.low) : null,
            open: d.open ? parseFloat(d.open) : null,
            volume: d.volume ? parseInt(d.volume) : null,
            high52: d.fifty_two_week?.high ? parseFloat(d.fifty_two_week.high) : null,
            low52: d.fifty_two_week?.low ? parseFloat(d.fifty_two_week.low) : null,
            pe: d.pe_ratio ? parseFloat(d.pe_ratio) : null,
            eps: d.eps ? parseFloat(d.eps) : null,
            datetime: d.datetime || ''
        };
    }
    throw new Error('No data from Twelve Data (no exchange)');
}

// ===== Gold Quote (XAU/USD) =====
async function fetchGoldQuote() {
    const res = await axios.get('https://api.twelvedata.com/quote', {
        params: { symbol: 'XAU/USD', apikey: Twelve_Data_API },
        timeout: 5000
    });
    if (res.data && res.data.close) {
        const d = res.data;
        return {
            symbol: 'XAU/USD',
            name: 'Gold (ทองคำ)',
            exchange: 'FOREX',
            currency: 'USD',
            price: parseFloat(d.close),
            change: parseFloat(d.change || 0),
            changePercent: parseFloat(d.percent_change || 0),
            high: d.high ? parseFloat(d.high) : null,
            low: d.low ? parseFloat(d.low) : null,
            open: d.open ? parseFloat(d.open) : null,
            volume: null,
            high52: d.fifty_two_week?.high ? parseFloat(d.fifty_two_week.high) : null,
            low52: d.fifty_two_week?.low ? parseFloat(d.fifty_two_week.low) : null,
            pe: null,
            eps: null,
            datetime: d.datetime || ''
        };
    }
    throw new Error('No gold data from Twelve Data');
}

// ===== Time Series (Historical Prices) =====
async function fetchTimeSeries(symbol, options = {}) {
    const { interval = '1day', outputsize = 30, exchange = null } = options;
    const params = {
        symbol,
        interval,
        outputsize,
        apikey: Twelve_Data_API
    };
    if (exchange) params.exchange = exchange;

    const res = await axios.get('https://api.twelvedata.com/time_series', {
        params,
        timeout: 10000
    });

    if (res.data && res.data.values) {
        return res.data.values.reverse().map(v => ({
            date: v.datetime.split(' ')[0],
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: v.volume ? parseInt(v.volume) : 0
        }));
    }
    throw new Error('No time series data');
}

// ===== Calculate Support & Resistance =====
function calculateSupportResistance(prices) {
    if (!prices || prices.length < 5) return { supports: [], resistances: [] };

    const closes = prices.map(p => p.close);
    const currentPrice = closes[closes.length - 1];

    // หา local min/max
    const pivots = [];
    for (let i = 2; i < closes.length - 2; i++) {
        // Local minimum
        if (closes[i] < closes[i - 1] && closes[i] < closes[i - 2] &&
            closes[i] < closes[i + 1] && closes[i] < closes[i + 2]) {
            pivots.push({ level: closes[i], type: 'support' });
        }
        // Local maximum
        if (closes[i] > closes[i - 1] && closes[i] > closes[i - 2] &&
            closes[i] > closes[i + 1] && closes[i] > closes[i + 2]) {
            pivots.push({ level: closes[i], type: 'resistance' });
        }
    }

    // เพิ่ม SMA levels
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);

    // แยก Support (< currentPrice) และ Resistance (> currentPrice)
    let supports = pivots
        .filter(p => p.level < currentPrice)
        .sort((a, b) => b.level - a.level) // เรียงจากใกล้ไปไกล
        .slice(0, 4);

    let resistances = pivots
        .filter(p => p.level > currentPrice)
        .sort((a, b) => a.level - b.level) // เรียงจากใกล้ไปไกล
        .slice(0, 4);

    // กำหนด strength ตาม proximity
    supports = supports.map((s, i) => ({ ...s, strength: Math.max(100 - i * 15, 50) }));
    resistances = resistances.map((r, i) => ({ ...r, strength: Math.max(100 - i * 15, 50) }));

    // ถ้าไม่มี pivot, ใช้ SMA
    if (supports.length === 0 && sma20 < currentPrice) {
        supports.push({ level: sma20, type: 'support', strength: 70 });
    }
    if (resistances.length === 0 && sma20 > currentPrice) {
        resistances.push({ level: sma20, type: 'resistance', strength: 70 });
    }

    return { supports, resistances, sma20, sma50 };
}

// ===== Technical Indicators (Twelve Data) =====
async function fetchTechnicalIndicators(symbol, exchange = null) {
    const indicators = {};
    const baseParams = { symbol, interval: '1day', apikey: Twelve_Data_API };
    if (exchange) baseParams.exchange = exchange;

    // RSI
    try {
        const res = await axios.get('https://api.twelvedata.com/rsi', {
            params: { ...baseParams, time_period: 14 },
            timeout: 8000
        });
        if (res.data?.values?.[0]) {
            indicators.rsi = parseFloat(res.data.values[0].rsi);
        }
    } catch (e) { console.log('RSI fetch error:', e.message); }

    // SMA 20
    try {
        const res = await axios.get('https://api.twelvedata.com/sma', {
            params: { ...baseParams, time_period: 20 },
            timeout: 8000
        });
        if (res.data?.values?.[0]) {
            indicators.sma20 = parseFloat(res.data.values[0].sma);
        }
    } catch (e) { console.log('SMA20 fetch error:', e.message); }

    // EMA 12
    try {
        const res = await axios.get('https://api.twelvedata.com/ema', {
            params: { ...baseParams, time_period: 12 },
            timeout: 8000
        });
        if (res.data?.values?.[0]) {
            indicators.ema12 = parseFloat(res.data.values[0].ema);
        }
    } catch (e) { console.log('EMA12 fetch error:', e.message); }

    // MACD
    try {
        const res = await axios.get('https://api.twelvedata.com/macd', {
            params: baseParams,
            timeout: 8000
        });
        if (res.data?.values?.[0]) {
            indicators.macd = parseFloat(res.data.values[0].macd);
            indicators.macdSignal = parseFloat(res.data.values[0].macd_signal);
            indicators.macdHist = parseFloat(res.data.values[0].macd_hist);
        }
    } catch (e) { console.log('MACD fetch error:', e.message); }

    return indicators;
}

// ===== News Fetcher =====
async function fetchNews(keyword, type = 'stock') {
    let allItems = [];

    if (type === 'gold') {
        // ข่าวทอง
        try {
            const feed = await parser.parseURL('https://www.huasengheng.com/feed/');
            allItems = allItems.concat(feed.items.slice(0, 5).map(item => ({
                title: item.title,
                link: item.link,
                source: 'ฮั่วเซ่งเฮง',
                pubDate: item.pubDate
            })));
        } catch (e) { console.log('Gold RSS error:', e.message); }
    } else {
        // ข่าวหุ้นไทย
        const feeds = [
            { url: 'https://www.kaohoon.com/feed', name: 'Kaohoon' },
            { url: 'https://www.bangkokbiznews.com/rss', name: 'กรุงเทพธุรกิจ' },
            { url: 'https://www.thansettakij.com/rss', name: 'ฐานเศรษฐกิจ' },
            { url: 'https://www.prachachat.net/feed', name: 'ประชาชาติ' }
        ];

        for (const f of feeds) {
            try {
                const feed = await parser.parseURL(f.url);
                allItems = allItems.concat(feed.items.map(item => ({
                    title: item.title,
                    link: item.link,
                    source: f.name,
                    pubDate: item.pubDate
                })));
            } catch (e) { console.log(`RSS error (${f.name}):`, e.message); }
        }

        // Yahoo Finance RSS
        try {
            const yahooFeed = await parser.parseURL(
                `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${keyword}.BK&region=US&lang=en-US`
            );
            allItems = allItems.concat(yahooFeed.items.map(item => ({
                title: item.title,
                link: item.link,
                source: 'Yahoo Finance',
                pubDate: item.pubDate
            })));
        } catch (e) { console.log('Yahoo RSS error:', e.message); }

        // GNews
        if (GNEWS_API_KEY) {
            try {
                const gnews = await axios.get(
                    `https://gnews.io/api/v4/search?q=${keyword}&lang=th&max=5&token=${GNEWS_API_KEY}`,
                    { timeout: 8000 }
                );
                allItems = allItems.concat(gnews.data.articles.map(a => ({
                    title: a.title,
                    link: a.url,
                    source: a.source?.name || 'GNews',
                    pubDate: a.publishedAt
                })));
            } catch (e) { console.log('GNews error:', e.message); }
        }
    }

    // Filter by keyword
    const filtered = allItems.filter(item => {
        const text = (item.title || '').toUpperCase();
        return text.includes(keyword.toUpperCase());
    });

    // Deduplicate by link
    const seen = new Set();
    const unique = [];
    for (const item of filtered) {
        if (!seen.has(item.link)) {
            seen.add(item.link);
            unique.push(item);
        }
    }

    // คำนวณ relative time
    return unique.slice(0, 10).map(item => {
        let timeAgo = '';
        if (item.pubDate) {
            const diff = Date.now() - new Date(item.pubDate).getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (days > 0) timeAgo = `${days} วันที่แล้ว`;
            else if (hours > 0) timeAgo = `${hours} ชม.ที่แล้ว`;
            else timeAgo = 'ล่าสุด';
        }
        return { ...item, timeAgo };
    });
}

// ===== Yahoo Finance - Stock Quote (Thai SET + .BK) =====
async function fetchStockQuoteYahoo(symbol) {
    const yahooSymbol = `${symbol}.BK`;
    console.log(`[YAHOO] Fetching quote for ${yahooSymbol}`);

    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
            interval: '1d',
            range: '5d'
        },
        headers: {
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 8000
    });

    const result = res.data?.chart?.result?.[0];
    if (!result || !result.meta) {
        throw new Error(`No Yahoo data for ${yahooSymbol}`);
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];

    // ดึงราคาปัจจุบัน
    const currentPrice = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // ดึง high/low จากวันล่าสุด
    let dayHigh = null, dayLow = null, dayVolume = null;
    if (quote && timestamps.length > 0) {
        const lastIdx = timestamps.length - 1;
        dayHigh = quote.high?.[lastIdx] || null;
        dayLow = quote.low?.[lastIdx] || null;
        dayVolume = quote.volume?.[lastIdx] || null;
    }

    console.log(`[YAHOO] ${symbol} price: ${currentPrice}`);

    return {
        symbol: symbol,
        name: meta.shortName || meta.symbol || symbol,
        exchange: 'SET',
        currency: meta.currency || 'THB',
        price: currentPrice,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        high: dayHigh,
        low: dayLow,
        open: quote?.open?.[timestamps.length - 1] || null,
        volume: dayVolume ? parseInt(dayVolume) : null,
        high52: meta.fiftyTwoWeekHigh || null,
        low52: meta.fiftyTwoWeekLow || null,
        pe: null,
        eps: null,
        datetime: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    };
}

// ===== Yahoo Finance - Time Series (Thai SET + .BK) =====
async function fetchTimeSeriesYahoo(symbol, days = 30) {
    const yahooSymbol = `${symbol}.BK`;
    console.log(`[YAHOO] Fetching time series for ${yahooSymbol}, ${days} days`);

    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`, {
        params: {
            interval: '1d',
            range: `${Math.min(days, 90)}d`
        },
        headers: {
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 8000
    });

    const result = res.data?.chart?.result?.[0];
    if (!result || !result.timestamp) {
        throw new Error(`No Yahoo time series for ${yahooSymbol}`);
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!quote) throw new Error('No quote data in Yahoo response');

    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
        const close = quote.close?.[i];
        if (close !== null && close !== undefined) {
            const date = new Date(timestamps[i] * 1000);
            prices.push({
                date: date.toISOString().split('T')[0],
                open: quote.open?.[i] || close,
                high: quote.high?.[i] || close,
                low: quote.low?.[i] || close,
                close: close,
                volume: quote.volume?.[i] || 0
            });
        }
    }

    if (prices.length === 0) throw new Error('No valid price data from Yahoo');
    console.log(`[YAHOO] Got ${prices.length} data points for ${symbol}`);
    return prices;
}

// ===== Yahoo Finance Crumb Auth =====
let yahooCrumb = null;
let yahooCookie = null;

async function getYahooCrumb() {
    if (yahooCrumb && yahooCookie) return { crumb: yahooCrumb, cookie: yahooCookie };

    console.log('[YAHOO] Getting crumb...');
    // Step 1: Get cookie
    const cookieRes = await axios.get('https://fc.yahoo.com/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: () => true // accept any status
    });

    const setCookies = cookieRes.headers['set-cookie'];
    if (setCookies) {
        yahooCookie = setCookies.map(c => c.split(';')[0]).join('; ');
    }

    // Step 2: Get crumb
    const crumbRes = await axios.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': yahooCookie || ''
        },
        timeout: 5000
    });

    yahooCrumb = crumbRes.data;
    console.log('[YAHOO] Crumb obtained OK');
    return { crumb: yahooCrumb, cookie: yahooCookie };
}

// ===== Yahoo Finance - Financial Data (งบการเงิน/เงินปันผล) =====
async function fetchFinancialData(symbol) {
    const yahooSymbol = `${symbol}.BK`;
    console.log(`[YAHOO] Fetching financial data for ${yahooSymbol}`);

    const { crumb, cookie } = await getYahooCrumb();

    const modules = [
        'summaryDetail',
        'defaultKeyStatistics',
        'incomeStatementHistory',
        'balanceSheetHistory',
        'cashflowStatementHistory'
    ].join(',');

    const res = await axios.get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}`, {
        params: { modules, crumb },
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': cookie || ''
        },
        timeout: 10000
    });

    const result = res.data?.quoteSummary?.result?.[0];
    if (!result) throw new Error(`No financial data for ${yahooSymbol}`);

    // ===== เงินปันผล =====
    const sd = result.summaryDetail || {};
    const ks = result.defaultKeyStatistics || {};
    const dividend = {
        rate: sd.dividendRate?.raw || null,
        yield: sd.dividendYield?.raw ? (sd.dividendYield.raw * 100).toFixed(2) : null,
        exDate: ks.lastDividendDate?.fmt || sd.exDividendDate?.fmt || null,
        payoutRatio: sd.payoutRatio?.raw ? (sd.payoutRatio.raw * 100).toFixed(1) : null,
        fiveYearAvg: ks.fiveYearAvgDividendYield?.raw ? ks.fiveYearAvgDividendYield.raw.toFixed(2) : null
    };

    // ===== Helper: format ตัวเลขเป็นล้าน/พันล้าน =====
    const fmtNum = (val) => {
        if (!val && val !== 0) return null;
        const n = typeof val === 'object' ? val.raw : val;
        if (!n && n !== 0) return null;
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + ' M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + ' K';
        return n.toFixed(2);
    };

    // ===== งบกำไรขาดทุน (Income Statement) =====
    const isHistory = result.incomeStatementHistory?.incomeStatementHistory || [];
    const incomeStatement = isHistory.length > 0 ? isHistory.slice(0, 2).map(stmt => ({
        period: stmt.endDate?.fmt || 'N/A',
        revenue: fmtNum(stmt.totalRevenue),
        grossProfit: fmtNum(stmt.grossProfit),
        operatingIncome: fmtNum(stmt.operatingIncome),
        netIncome: fmtNum(stmt.netIncome),
        ebit: fmtNum(stmt.ebit)
    })) : null;

    // ===== งบดุล (Balance Sheet) =====
    const bsHistory = result.balanceSheetHistory?.balanceSheetStatements || [];
    const balanceSheet = bsHistory.length > 0 ? bsHistory.slice(0, 2).map(stmt => ({
        period: stmt.endDate?.fmt || 'N/A',
        totalAssets: fmtNum(stmt.totalAssets),
        totalLiabilities: fmtNum(stmt.totalLiab),
        totalEquity: fmtNum(stmt.totalStockholderEquity),
        cash: fmtNum(stmt.cash),
        totalDebt: fmtNum(stmt.longTermDebt)
    })) : null;

    // ===== กระแสเงินสด (Cash Flow) =====
    const cfHistory = result.cashflowStatementHistory?.cashflowStatements || [];
    const cashFlow = cfHistory.length > 0 ? cfHistory.slice(0, 2).map(stmt => ({
        period: stmt.endDate?.fmt || 'N/A',
        operatingCF: fmtNum(stmt.totalCashFromOperatingActivities),
        investingCF: fmtNum(stmt.totalCashflowsFinancing),
        financingCF: fmtNum(stmt.totalCashFromFinancingActivities),
        freeCashFlow: fmtNum(stmt.freeCashFlow),
        capEx: fmtNum(stmt.capitalExpenditures)
    })) : null;

    console.log(`[YAHOO] Financial data OK for ${symbol}: dividend=${!!dividend.rate}, IS=${!!incomeStatement}, BS=${!!balanceSheet}, CF=${!!cashFlow}, PE=${sd.trailingPE?.raw || ks.trailingPE?.raw || 'N/A'}`);

    return {
        dividend, incomeStatement, balanceSheet, cashFlow,
        _summaryDetail: { trailingPE: sd.trailingPE?.raw || null },
        _keyStats: {
            trailingPE: ks.trailingPE?.raw || null,
            forwardPE: ks.forwardPE?.raw || null,
            trailingEps: ks.trailingEps?.raw || null
        }
    };
}

module.exports = {
    fetchStockQuote,
    fetchStockQuoteNoExchange,
    fetchStockQuoteYahoo,
    fetchGoldQuote,
    fetchTimeSeries,
    fetchTimeSeriesYahoo,
    calculateSupportResistance,
    fetchTechnicalIndicators,
    fetchFinancialData,
    fetchNews
};
