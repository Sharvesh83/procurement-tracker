const fs = require('fs');
const csv = require('csv-parser');
const ProcurementRecord = require('../models/ProcurementRecord');
const Dataset = require('../models/Dataset');
const Upload = require('../models/Upload');
const riskScoringService = require('../services/ML/risk_scoring.service');

// Helper: Normalize header string
const normalizeHeader = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

exports.uploadDataset = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;

        // 1. Deactivate old datasets
        await Dataset.updateMany({}, { is_active: false });

        // 2. Create new Active Dataset
        const newDataset = await Dataset.create({
            dataset_name: fileName,
            is_active: true,
            uploaded_at: new Date()
        });

        const records = [];
        let validCount = 0;
        let skippedCount = 0;

        // Flexible Header Mapping
        const mapHeader = (header) => {
            const h = normalizeHeader(header);
            if (h.includes('tenderno') || h.includes('referenceno') || h.includes('tenderid')) return 'tender_no';
            if (h.includes('agency') || h.includes('department') || h.includes('ministry')) return 'agency';
            if (h.includes('supplier') || h.includes('vendor') || h.includes('contractor')) return 'supplier_name';
            if (h.includes('amount') || h.includes('value') || h.includes('cost') || h.includes('awardedamt')) return 'awarded_amt';
            if (h.includes('date') || h.includes('award')) return 'award_date';
            if (h.includes('status') || h.includes('detail')) return 'tender_detail_status';
            if (h.includes('desc') || h.includes('description')) return 'tender_description';
            return null;
        };

        fs.createReadStream(filePath)
            .pipe(csv({
                mapHeaders: ({ header }) => mapHeader(header) || null
            }))
            .on('headers', (headers) => {
                console.log('CSV Headers:', headers);
            })
            .on('data', (row) => {
                // Validate Core Fields (using mapped keys)
                if (!row.tender_no || !row.agency || !row.awarded_amt) {
                    skippedCount++;
                    return;
                }

                const amt = parseFloat(String(row.awarded_amt).replace(/,/g, ''));
                if (isNaN(amt)) {
                    skippedCount++;
                    return;
                }

                // Create Record Object with "Pending" Risk
                const cleanRecord = {
                    dataset_id: newDataset._id,
                    tender_no: row.tender_no,
                    agency: row.agency,
                    supplier_name: row.supplier_name || 'Unknown',
                    awarded_amt: amt,
                    award_date: new Date(row.award_date) == 'Invalid Date' ? new Date() : new Date(row.award_date),
                    tender_detail_status: row.tender_detail_status || 'Completed',
                    source_file_name: fileName,

                    // Risk Fields Initialized
                    risk_score: 0,
                    risk_level: 'Pending',
                    risk_flags: [],
                    risk_explanation: 'Analysis Pending...'
                };

                records.push(cleanRecord);
                validCount++;
            })
            .on('end', async () => {
                try {
                    if (records.length > 0) {
                        // 3. Bulk Insert
                        await ProcurementRecord.insertMany(records);

                        // 4. Trigger ML Risk Scoring
                        console.log('Triggering ML Risk Scoring...');
                        await riskScoringService.processDataset(newDataset._id);

                        // 5. Update Dataset Stats (Post-ML)
                        newDataset.record_count = validCount;
                        await newDataset.save();

                        // 6. Fetch Risk Summary from DB (Source of Truth)
                        const datasetRecords = await ProcurementRecord.find({ dataset_id: newDataset._id }, 'risk_level');
                        const summary = {
                            high: datasetRecords.filter(r => r.risk_level === 'High').length,
                            medium: datasetRecords.filter(r => r.risk_level === 'Medium').length,
                            low: datasetRecords.filter(r => r.risk_level === 'Low').length
                        };

                        // Legacy Upload Log
                        try {
                            await Upload.create({
                                file_name: fileName,
                                file_type: 'csv',
                                total_records: validCount,
                                upload_status: 'success'
                            });
                        } catch (e) { console.log("Legacy upload log error", e); }

                        res.json({
                            message: 'Dataset processed and risk-scored successfully',
                            dataset_id: newDataset._id,
                            dataset_name: newDataset.dataset_name,
                            uploaded_at: newDataset.uploaded_at,
                            valid_records: validCount,
                            skipped_records: skippedCount,
                            risk_summary: summary
                        });
                    } else {
                        res.status(400).json({ message: 'No valid records found in file' });
                    }
                } catch (dbError) {
                    console.error('Processing Error:', dbError);
                    res.status(500).json({ message: `Error processing dataset: ${dbError.message}` });
                } finally {
                    // Cleanup file
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Error deleting temp file:', err);
                    });
                }
            })
            .on('error', (error) => {
                console.error('CSV Parse Error:', error);
                res.status(500).json({ message: 'Error parsing CSV file' });
            });

    } catch (error) {
        console.error('Upload Controller Error:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
};
