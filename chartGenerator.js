/**
 * Chart Generator - สร้าง URL กราฟราคาผ่าน QuickChart.io
 */

/**
 * สร้าง URL กราฟราคาหุ้น/ทอง
 * @param {string} symbol - ชื่อหุ้น
 * @param {Array} prices - [{date, close}]
 * @param {string} name - ชื่อบริษัท/สินทรัพย์
 * @returns {string} URL ของกราฟ
 */
function generatePriceChartUrl(symbol, prices, name = '') {
    if (!prices || prices.length === 0) return null;

    const labels = prices.map(p => p.date);
    const data = prices.map(p => parseFloat(p.close));

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} ${name}`.trim(),
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
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top', labels: { color: '#fff', font: { size: 11 } } },
                title: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: '#ccc', maxTicksLimit: 8, font: { size: 9 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    ticks: { color: '#ccc', font: { size: 10 } },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    };

    const chartJson = encodeURIComponent(JSON.stringify(chartConfig));
    return `https://quickchart.io/chart?c=${chartJson}&w=600&h=300&bkg=%23111111`;
}

/**
 * สร้าง URL กราฟ Support & Resistance
 */
function generateSRChartUrl(symbol, prices, supports, resistances) {
    if (!prices || prices.length === 0) return null;

    const labels = prices.map(p => p.date);
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

    // เพิ่มเส้น Support
    if (supports && supports.length > 0) {
        supports.slice(0, 3).forEach((s, i) => {
            datasets.push({
                label: `Support: ${s.level}`,
                data: Array(labels.length).fill(s.level),
                borderColor: i === 0 ? '#FF5252' : i === 1 ? '#FF8A80' : '#FFCDD2',
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });
        });
    }

    // เพิ่มเส้น Resistance
    if (resistances && resistances.length > 0) {
        resistances.slice(0, 3).forEach((r, i) => {
            datasets.push({
                label: `Resistance: ${r.level}`,
                data: Array(labels.length).fill(r.level),
                borderColor: i === 0 ? '#69F0AE' : i === 1 ? '#B9F6CA' : '#E8F5E9',
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
            responsive: true,
            plugins: {
                legend: { display: true, position: 'bottom', labels: { color: '#fff', font: { size: 9 } } },
                title: { display: true, text: `${symbol} - Support & Resistance Analysis`, color: '#fff', font: { size: 13 } }
            },
            scales: {
                x: { ticks: { color: '#ccc', maxTicksLimit: 8, font: { size: 8 } }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    };

    const chartJson = encodeURIComponent(JSON.stringify(chartConfig));
    return `https://quickchart.io/chart?c=${chartJson}&w=600&h=350&bkg=%23111111`;
}

module.exports = { generatePriceChartUrl, generateSRChartUrl };
