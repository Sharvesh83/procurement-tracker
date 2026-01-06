const http = require('http');

const get = (path) => {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:5000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data); // Return text if not JSON
                }
            });
        }).on('error', reject);
    });
};

async function runTests() {
    console.log('--- Testing Backend API ---');

    // 1. Check Active Dataset
    try {
        const dataset = await get('/api/datasets/active');
        console.log('Active Dataset:', dataset ? dataset.dataset_name : 'None');
    } catch (e) { console.error('Active Dataset Error:', e.message); }

    // 2. Check Analytics Summary (Testing Aggregation)
    try {
        const summary = await get('/api/analytics/summary');
        console.log('Analytics Summary:', {
            total_records: summary.total_records,
            total_spend: summary.total_spend, // Should be number, not 0 if fixed
            dept_spend_count: summary.department_spend?.length
        });
    } catch (e) { console.error('Analytics Error:', e.message); }

    // 3. Check Records (Testing Field Selection)
    try {
        const records = await get('/api/procurement-records?limit=1');
        console.log('Sample Record:', records.records?.[0] ? 'Found' : 'None');
        if (records.records?.[0]) {
            console.log('Record Fields:', Object.keys(records.records[0]));
            console.log('Record Sample:', {
                agency: records.records[0].agency,
                awarded_amt: records.records[0].awarded_amt
            });
        }
    } catch (e) { console.error('Records Error:', e.message); }
}

runTests();
