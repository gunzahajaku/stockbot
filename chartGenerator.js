/**
 * Chart Generator - สร้าง URL กราฟราคาผ่าน QuickChart.io
 * ใช้ POST /chart/create เพื่อสร้าง short URL (LINE จำกัด URL ไว้ 2000 ตัวอักษร)
 */

const axios = require('axios');

/**
 * สร้าง short URL จาก QuickChart API
 * @param {Object} chartConfig - Chart.js config
 * @param {number} width
 * @param {number} height
 * @returns {string|null} short URL
 */
async function createShortChartUrl(chartConfig, width = 600, height = 300) {
    try {
        const res = await axios.post('https://quickchart.io/chart/create', {
            chart: chartConfig,
            width: width,
            height: height,
            backgroundColor: '#111111',
            format: 'png'
        }, { timeout: 5000 });

        if (res.data && res.data.url) {
            return res.data.url; // short URL like https://quickchart.io/chart/render/xxxxx
        }
        return null;
    } catch (err) {
        console.error('QuickChart create error:', err.message);
        return null;
    }
}

/**
 * สร้าง URL กราฟราคาหุ้น/ทอง
 * @param {string} symbol - ชื่อหุ้น
 * @param {Array} prices - [{date, close}]
 * @param {string} name - ชื่อบริษัท/สินทรัพย์
 * @returns {string|null} URL ของกราฟ
 */
async function generatePriceChartUrl(symbol, prices, name = '') {
    if (!prices || prices.length === 0) return null;

    // ย่อ labels ให้สั้นลง (dd/mm)
    const labels = prices.map(p => {
        const parts = p.date.split('-');
        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : p.date;
    });
    const data = prices.map(p => parseFloat(p.close));

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol}`,
                data: data,
                borderColor: '#00C853',
                backgroundColor: 'rgba(0,200,83,0.1)',
                fill: true,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: {
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#fff', font: { size: 11 } } }
            },
            scales: {
                x: {
                    ticks: { color: '#ccc', maxTicksLimit: 6, font: { size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    ticks: { color: '#ccc', font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    };

    return await createShortChartUrl(chartConfig, 600, 300);
}

/**
 * สร้าง URL กราฟ Support & Resistance
 */
async function generateSRChartUrl(symbol, prices, supports, resistances) {
    if (!prices || prices.length === 0) return null;

    const labels = prices.map(p => {
        const parts = p.date.split('-');
        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : p.date;
    });
    const data = prices.map(p => parseFloat(p.close));

    const datasets = [{
        label: 'Price',
        data: data,
        borderColor: '#00C853',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3
    }];

    // เพิ่มเส้น Support (ลดเหลือ 2 เส้น)
    if (supports && supports.length > 0) {
        supports.slice(0, 2).forEach((s, i) => {
            datasets.push({
                label: `S${i + 1}: ${s.level.toFixed(2)}`,
                data: Array(labels.length).fill(s.level),
                borderColor: i === 0 ? '#FF5252' : '#FF8A80',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        });
    }

    // เพิ่มเส้น Resistance (ลดเหลือ 2 เส้น)
    if (resistances && resistances.length > 0) {
        resistances.slice(0, 2).forEach((r, i) => {
            datasets.push({
                label: `R${i + 1}: ${r.level.toFixed(2)}`,
                data: Array(labels.length).fill(r.level),
                borderColor: i === 0 ? '#69F0AE' : '#B9F6CA',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        });
    }

    const chartConfig = {
        type: 'line',
        data: { labels, datasets },
        options: {
            plugins: {
                legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 9 } } },
                title: { display: true, text: `${symbol} S/R`, color: '#fff', font: { size: 13 } }
            },
            scales: {
                x: { ticks: { color: '#ccc', maxTicksLimit: 6, font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    };

    return await createShortChartUrl(chartConfig, 600, 350);
}

module.exports = { generatePriceChartUrl, generateSRChartUrl };
