const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const ProcurementRecord = require('./models/ProcurementRecord');
const Dataset = require('./models/Dataset');
require('dotenv').config();

const filePath = './phase2_test.csv';

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Deactivate old
        await Dataset.updateMany({}, { is_active: false });

        const newDataset = await Dataset.create({
            dataset_name: 'phase2_test.csv',
            is_active: true,
            uploaded_at: new Date(),
            record_count: 0
        });

        const records = [];
        let validCount = 0;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Flexible mapping logic copy-pasted/simplified from controller
                // Assuming the CSV headers in phase2_test.csv are standard or we map them manually
                // Let's print the first row keys to be sure if debugging, but here we just try to map

                const getVal = (u, l) => row[u] || row[l];

                // Map based on expected headers from a standard CSV or the one we just saw
                // "Tender No", "Agency", "Supplier Name", "Awarded Amount", "Award Date", "Status"

                // We'll use the flexible logic from controller but inline here for simplicity
                const keys = Object.keys(row);
                const findKey = (search) => keys.find(k => k.toLowerCase().replace(/[^a-z]/g, '').includes(search));

                const tender_no = row[findKey('tender') || 'Tender No'];
                const agency = row[findKey('agency') || findKey('department') || 'Agency'];
                const supplier = row[findKey('supplier') || findKey('vendor') || 'Supplier Name'];
                const amountRaw = row[findKey('amount') || findKey('value') || 'Awarded Amount'];
                const dateRaw = row[findKey('date') || 'Award Date'];
                const status = row[findKey('status') || 'Status'];

                if (tender_no && agency && amountRaw) {
                    const amt = parseFloat(String(amountRaw).replace(/,/g, ''));
                    // Risk Calc
                    let score = 0;
                    let flags = [];
                    if (amt > 1000000) { score++; flags.push('High Value'); }
                    if ((status || '').toLowerCase().includes('fail')) { score += 2; flags.push('Failed Status'); }

                    let riskLevel = 'Low';
                    if (score >= 2) riskLevel = 'High';
                    else if (score >= 1) riskLevel = 'Medium';

                    records.push({
                        dataset_id: newDataset._id,
                        tender_no,
                        agency,
                        supplier_name: supplier || 'Unknown',
                        awarded_amt: amt,
                        award_date: new Date(dateRaw) || new Date(),
                        tender_detail_status: status || 'Completed',
                        source_file_name: 'phase2_test.csv',
                        risk_score: score,
                        risk_level: riskLevel,
                        risk_flags: flags
                    });
                    validCount++;
                }
            })
            .on('end', async () => {
                if (records.length > 0) {
                    await ProcurementRecord.insertMany(records);
                    newDataset.record_count = validCount;
                    await newDataset.save();
                    console.log(`Seeded ${validCount} records successfully.`);
                } else {
                    console.log('No records found to seed.');
                }
                process.exit();
            });

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

seed();
