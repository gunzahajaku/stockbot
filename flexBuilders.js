/**
 * Flex Builders - สร้าง LINE Flex Message JSON
 */

/**
 * สร้าง Flex Message Card ภาพรวมหุ้น/ทอง
 */
function buildStockCard(data, chartUrl) {
    const isGold = data.symbol === 'XAU/USD';
    const changeIcon = data.change >= 0 ? '▲' : '▼';
    const changeColor = data.change >= 0 ? '#00C853' : '#FF1744';
    const currencySymbol = isGold ? '$' : '฿';
    const exchangeLabel = isGold ? 'FOREX' : 'SET';
    const unitLabel = isGold ? 'USD/oz' : 'THB';

    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const thaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const bubble = {
        type: 'bubble',
        size: 'giga',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [],
            backgroundColor: '#1a1a2e',
            paddingAll: '0px'
        }
    };

    const contents = bubble.body.contents;

    // Hero image (chart)
    if (chartUrl) {
        contents.push({
            type: 'image',
            url: chartUrl,
            size: 'full',
            aspectRatio: '2:1',
            aspectMode: 'cover'
        });
    }

    // Body content
    contents.push({
        type: 'box',
        layout: 'vertical',
        contents: [
            // Symbol & Name
            {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: `${data.symbol} (${exchangeLabel})`,
                                weight: 'bold',
                                size: 'xl',
                                color: '#FFFFFF'
                            },
                            {
                                type: 'text',
                                text: data.name || data.symbol,
                                size: 'sm',
                                color: '#AAAAAA',
                                margin: 'xs'
                            }
                        ],
                        flex: 3
                    }
                ]
            },
            { type: 'separator', margin: 'lg', color: '#333333' },
            // Price info
            {
                type: 'box',
                layout: 'vertical',
                contents: [
                    buildInfoRow('Price', `${currencySymbol}${data.price.toFixed(2)} ${unitLabel}`, '#FFFFFF', true),
                    buildInfoRow('Change', `${changeIcon} ${Math.abs(data.change).toFixed(2)} (${Math.abs(data.changePercent).toFixed(2)}%)`, changeColor),
                    ...(data.high && data.low ?
                        [buildInfoRow('Today', `${currencySymbol}${data.low.toFixed(2)} – ${currencySymbol}${data.high.toFixed(2)}`, '#CCCCCC')] : []),
                    ...(data.high52 && data.low52 ?
                        [buildInfoRow('52W', `${currencySymbol}${data.low52.toFixed(2)} – ${currencySymbol}${data.high52.toFixed(2)}`, '#CCCCCC')] : []),
                    ...(data.pe !== null && data.pe !== undefined ?
                        [buildInfoRow('PE (TTM)', data.pe.toFixed(2), '#CCCCCC')] : []),
                    ...(data.eps !== null && data.eps !== undefined ?
                        [buildInfoRow('EPS (TTM)', data.eps.toFixed(2), '#CCCCCC')] : []),
                    ...(data.volume ?
                        [buildInfoRow('Volume', data.volume.toLocaleString(), '#CCCCCC')] : [])
                ],
                margin: 'lg'
            },
            // Updated time
            {
                type: 'text',
                text: `Updated: ${thaiDate} ${thaiTime}`,
                size: 'xs',
                color: '#888888',
                margin: 'lg'
            }
        ],
        paddingAll: '20px'
    });

    // Footer - ดูข้อมูลเชิงลึก button
    contents.push({
        type: 'box',
        layout: 'vertical',
        contents: [
            {
                type: 'button',
                action: {
                    type: 'postback',
                    label: 'ดูข้อมูลเชิงลึก',
                    data: `action=detail_menu&symbol=${data.symbol}&type=${isGold ? 'gold' : 'stock'}`
                },
                style: 'primary',
                color: '#00C853',
                height: 'md'
            }
        ],
        paddingAll: '15px',
        backgroundColor: '#1a1a2e'
    });

    return {
        type: 'flex',
        altText: `${data.symbol} - ${currencySymbol}${data.price.toFixed(2)}`,
        contents: bubble
    };
}

/**
 * สร้าง Flex Message เมนูข้อมูลเชิงลึก
 */
function buildDetailMenu(symbol, type = 'stock') {
    const isGold = type === 'gold';

    const menuItems = [
        { icon: '📈', label: 'ภาพรวมและราคา', action: 'overview' },
        { icon: '🔄', label: 'แนวรับและต้าน (S/R)', action: 'sr' },
        { icon: '📊', label: 'ตัวชี้วัดทางเทคนิค', action: 'technical' },
        { icon: '💰', label: 'เงินปันผล', action: 'dividend' },
        { icon: '📋', label: 'งบกำไรขาดทุน (IS)', action: 'income' },
        { icon: '📊', label: 'งบดุล (BS)', action: 'balance' },
        { icon: '💧', label: 'กระแสเงินสด (CF)', action: 'cashflow' },
        { icon: '🧩', label: 'การแบ่งส่วนรายได้ (RS)', action: 'revenue' },
        { icon: '📰', label: 'ดูข่าวที่เกี่ยวข้องล่าสุด', action: 'news' },
        { icon: '🔔', label: 'รับการแจ้งเตือนข่าวใหม่', action: 'alert' }
    ];

    // ถ้าเป็นทอง ตัดบาง menu ที่ไม่เกี่ยว
    const filteredItems = isGold
        ? menuItems.filter(m => ['overview', 'sr', 'technical', 'news', 'alert'].includes(m.action))
        : menuItems;

    const buttons = filteredItems.map(item => ({
        type: 'button',
        action: {
            type: 'postback',
            label: `${item.icon} ${item.label}`,
            data: `action=${item.action}&symbol=${symbol}&type=${type}`,
            displayText: `${item.icon} ${item.label} ${symbol}`
        },
        style: 'secondary',
        height: 'sm',
        margin: 'sm',
        color: '#F0F0F0'
    }));

    const bubble = {
        type: 'bubble',
        size: 'giga',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: `เลือกข้อมูลเชิงลึก ${symbol}`,
                    weight: 'bold',
                    size: 'lg',
                    color: '#333333'
                },
                {
                    type: 'text',
                    text: 'กดเลือกหมวดที่ต้องการดู:',
                    size: 'sm',
                    color: '#888888',
                    margin: 'sm'
                },
                { type: 'separator', margin: 'lg' },
                {
                    type: 'box',
                    layout: 'vertical',
                    contents: buttons,
                    margin: 'lg'
                }
            ],
            paddingAll: '20px'
        }
    };

    return {
        type: 'flex',
        altText: `เลือกข้อมูลเชิงลึก ${symbol}`,
        contents: bubble
    };
}

/**
 * สร้าง Flex Message แนวรับ-แนวต้าน
 */
function buildSupportResistance(symbol, srData, chartUrl, currentPrice) {
    const contents = [];

    // Chart image
    if (chartUrl) {
        contents.push({
            type: 'image',
            url: chartUrl,
            size: 'full',
            aspectRatio: '2:1',
            aspectMode: 'cover'
        });
    }

    const bodyContents = [
        {
            type: 'text',
            text: `📊 การวิเคราะห์แนวรับและแนวต้าน: ${symbol}`,
            weight: 'bold',
            size: 'md',
            color: '#333333',
            wrap: true
        },
        {
            type: 'text',
            text: `วิเคราะห์ข้อมูล 30 วันล่าสุด`,
            size: 'xs',
            color: '#888888',
            margin: 'sm'
        },
        { type: 'separator', margin: 'lg' }
    ];

    // Support Levels
    if (srData.supports && srData.supports.length > 0) {
        bodyContents.push({
            type: 'text',
            text: '🛡️ แนวรับ (Support Levels)',
            weight: 'bold',
            size: 'sm',
            color: '#FF5252',
            margin: 'lg'
        });

        srData.supports.forEach((s, i) => {
            bodyContents.push({
                type: 'text',
                text: `  • แนวที่${i + 1}: ${s.level.toFixed(2)} (ความแข็งแรง: ${s.strength}%)`,
                size: 'xs',
                color: '#555555',
                margin: 'xs',
                wrap: true
            });
        });
    }

    // Resistance Levels
    if (srData.resistances && srData.resistances.length > 0) {
        bodyContents.push({
            type: 'text',
            text: '🚀 แนวต้าน (Resistance Levels)',
            weight: 'bold',
            size: 'sm',
            color: '#00C853',
            margin: 'lg'
        });

        srData.resistances.forEach((r, i) => {
            bodyContents.push({
                type: 'text',
                text: `  • แนวที่${i + 1}: ${r.level.toFixed(2)} (ความแข็งแรง: ${r.strength}%)`,
                size: 'xs',
                color: '#555555',
                margin: 'xs',
                wrap: true
            });
        });
    }

    contents.push({
        type: 'box',
        layout: 'vertical',
        contents: bodyContents,
        paddingAll: '20px'
    });

    return {
        type: 'flex',
        altText: `แนวรับและต้าน ${symbol}`,
        contents: {
            type: 'bubble',
            size: 'giga',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: contents,
                paddingAll: '0px'
            }
        }
    };
}

/**
 * สร้าง Flex Message ตัวชี้วัดทางเทคนิค
 */
function buildTechnicalIndicators(symbol, indicators) {
    const rows = [];

    if (indicators.rsi !== undefined) {
        let signal = 'ปกติ';
        let signalColor = '#FFFFFF';
        if (indicators.rsi > 70) { signal = 'Overbought 🔴'; signalColor = '#FF5252'; }
        else if (indicators.rsi < 30) { signal = 'Oversold 🟢'; signalColor = '#00C853'; }
        rows.push(buildTechRow('RSI (14)', indicators.rsi.toFixed(2), signal, signalColor));
    }

    if (indicators.sma20 !== undefined) {
        rows.push(buildTechRow('SMA (20)', indicators.sma20.toFixed(2), '', '#CCCCCC'));
    }

    if (indicators.ema12 !== undefined) {
        rows.push(buildTechRow('EMA (12)', indicators.ema12.toFixed(2), '', '#CCCCCC'));
    }

    if (indicators.macd !== undefined) {
        let signal = indicators.macd > indicators.macdSignal ? 'Bullish 🟢' : 'Bearish 🔴';
        let signalColor = indicators.macd > indicators.macdSignal ? '#00C853' : '#FF5252';
        rows.push(buildTechRow('MACD', indicators.macd.toFixed(4), signal, signalColor));
        rows.push(buildTechRow('MACD Signal', indicators.macdSignal.toFixed(4), '', '#CCCCCC'));
    }

    const bubble = {
        type: 'bubble',
        size: 'giga',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: `📊 ตัวชี้วัดทางเทคนิค: ${symbol}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#FFFFFF',
                    wrap: true
                },
                { type: 'separator', margin: 'lg', color: '#333333' },
                {
                    type: 'box',
                    layout: 'vertical',
                    contents: rows.length > 0 ? rows : [{
                        type: 'text',
                        text: 'ไม่สามารถดึงข้อมูลได้',
                        color: '#888888',
                        size: 'sm'
                    }],
                    margin: 'lg'
                }
            ],
            paddingAll: '20px',
            backgroundColor: '#1a1a2e'
        }
    };

    return {
        type: 'flex',
        altText: `ตัวชี้วัดทางเทคนิค ${symbol}`,
        contents: bubble
    };
}

/**
 * สร้าง Flex Message ข่าว
 */
function buildNewsMessage(symbol, articles) {
    if (!articles || articles.length === 0) {
        return {
            type: 'text',
            text: `📰 ไม่พบข่าวของ ${symbol}`
        };
    }

    const newsItems = articles.slice(0, 8).map((article, i) => ({
        type: 'box',
        layout: 'vertical',
        contents: [
            {
                type: 'text',
                text: `${i + 1}. ${article.title}`,
                size: 'sm',
                color: '#333333',
                wrap: true,
                weight: 'bold'
            },
            {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: article.source || '',
                        size: 'xs',
                        color: '#888888',
                        flex: 2
                    },
                    {
                        type: 'text',
                        text: article.timeAgo || '',
                        size: 'xs',
                        color: '#888888',
                        align: 'end',
                        flex: 1
                    }
                ],
                margin: 'xs'
            }
        ],
        margin: 'lg',
        action: article.link ? {
            type: 'uri',
            label: 'read',
            uri: article.link
        } : undefined
    }));

    const bubble = {
        type: 'bubble',
        size: 'giga',
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: `📰 ข่าวหุ้น: ${symbol}`,
                    weight: 'bold',
                    size: 'lg',
                    color: '#333333'
                },
                {
                    type: 'text',
                    text: `ทั้งหมด ${articles.length} รายการ`,
                    size: 'xs',
                    color: '#888888',
                    margin: 'xs'
                },
                { type: 'separator', margin: 'lg' },
                {
                    type: 'box',
                    layout: 'vertical',
                    contents: newsItems,
                    margin: 'sm'
                }
            ],
            paddingAll: '20px'
        }
    };

    return {
        type: 'flex',
        altText: `ข่าว ${symbol} - ${articles.length} รายการ`,
        contents: bubble
    };
}

/**
 * สร้าง Flex Message สำหรับ feature ที่ยังไม่พร้อม
 */
function buildComingSoon(symbol, featureName) {
    return {
        type: 'flex',
        altText: `${featureName} - Coming Soon`,
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🚧 กำลังพัฒนา',
                        weight: 'bold',
                        size: 'lg',
                        color: '#FF9800'
                    },
                    {
                        type: 'text',
                        text: `ฟีเจอร์ "${featureName}" สำหรับ ${symbol}`,
                        size: 'sm',
                        color: '#555555',
                        margin: 'md',
                        wrap: true
                    },
                    {
                        type: 'text',
                        text: 'ขออภัย ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา จะเปิดให้บริการเร็วๆ นี้',
                        size: 'xs',
                        color: '#888888',
                        margin: 'md',
                        wrap: true
                    }
                ],
                paddingAll: '20px'
            }
        }
    };
}

/**
 * สร้าง Flex Message ภาพรวมและราคา (detailed)
 */
function buildOverview(data) {
    const isGold = data.symbol === 'XAU/USD';
    const changeIcon = data.change >= 0 ? '▲' : '▼';
    const changeColor = data.change >= 0 ? '#00C853' : '#FF1744';
    const currencySymbol = isGold ? '$' : '฿';

    const rows = [
        buildInfoRow('💰 ราคาปัจจุบัน', `${currencySymbol}${data.price.toFixed(2)}`, '#FFFFFF', true),
        buildInfoRow('📊 เปลี่ยนแปลง', `${changeIcon} ${Math.abs(data.change).toFixed(2)} (${Math.abs(data.changePercent).toFixed(2)}%)`, changeColor),
    ];

    if (data.open) rows.push(buildInfoRow('🔓 เปิด', `${currencySymbol}${data.open.toFixed(2)}`, '#CCCCCC'));
    if (data.high && data.low) {
        rows.push(buildInfoRow('📌 สูง', `${currencySymbol}${data.high.toFixed(2)}`, '#CCCCCC'));
        rows.push(buildInfoRow('📌 ต่ำ', `${currencySymbol}${data.low.toFixed(2)}`, '#CCCCCC'));
    }
    if (data.high52 && data.low52) {
        rows.push(buildInfoRow('📅 52W สูง', `${currencySymbol}${data.high52.toFixed(2)}`, '#CCCCCC'));
        rows.push(buildInfoRow('📅 52W ต่ำ', `${currencySymbol}${data.low52.toFixed(2)}`, '#CCCCCC'));
    }
    if (data.pe) rows.push(buildInfoRow('📈 P/E', data.pe.toFixed(2), '#CCCCCC'));
    if (data.eps) rows.push(buildInfoRow('💵 EPS', data.eps.toFixed(2), '#CCCCCC'));
    if (data.volume) rows.push(buildInfoRow('📦 Volume', data.volume.toLocaleString(), '#CCCCCC'));

    return {
        type: 'flex',
        altText: `ภาพรวม ${data.symbol}`,
        contents: {
            type: 'bubble',
            size: 'giga',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `📈 ภาพรวมและราคา: ${data.symbol}`,
                        weight: 'bold',
                        size: 'md',
                        color: '#FFFFFF',
                        wrap: true
                    },
                    {
                        type: 'text',
                        text: data.name || data.symbol,
                        size: 'xs',
                        color: '#AAAAAA',
                        margin: 'xs'
                    },
                    { type: 'separator', margin: 'lg', color: '#333333' },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: rows,
                        margin: 'lg'
                    }
                ],
                paddingAll: '20px',
                backgroundColor: '#1a1a2e'
            }
        }
    };
}

// ===== Helper Functions =====

function buildInfoRow(label, value, valueColor = '#FFFFFF', bold = false) {
    return {
        type: 'box',
        layout: 'horizontal',
        contents: [
            {
                type: 'text',
                text: label,
                size: 'sm',
                color: '#AAAAAA',
                flex: 2
            },
            {
                type: 'text',
                text: value,
                size: 'sm',
                color: valueColor,
                align: 'end',
                weight: bold ? 'bold' : 'regular',
                flex: 3
            }
        ],
        margin: 'md'
    };
}

function buildTechRow(label, value, signal, signalColor) {
    const contents = [
        { type: 'text', text: label, size: 'sm', color: '#AAAAAA', flex: 2 },
        { type: 'text', text: value, size: 'sm', color: '#FFFFFF', align: 'end', flex: 1 }
    ];
    if (signal) {
        contents.push({ type: 'text', text: signal, size: 'xs', color: signalColor, align: 'end', flex: 2 });
    }
    return { type: 'box', layout: 'horizontal', contents, margin: 'md' };
}

module.exports = {
    buildStockCard,
    buildDetailMenu,
    buildSupportResistance,
    buildTechnicalIndicators,
    buildNewsMessage,
    buildComingSoon,
    buildOverview
};
