const fs = require('fs');
const csv = require('csv-parser');
const ProcurementRecord = require('../models/ProcurementRecord');
const Upload = require('../models/Upload');
const Dataset = require('../models/Dataset');
const { computeBaselines } = require('../services/analyticsService');

// @desc    Upload dataset
// @route   POST /api/upload-dataset
// @access  Private
const uploadDataset = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const results = [];
    let validRecords = 0;
    let skippedRecords = 0;

    try {
        // 1. Deactivate all existing datasets
        await Dataset.updateMany({}, { is_active: false });

        // 2. Create new Active Dataset
        const newDataset = await Dataset.create({
            dataset_name: fileName,
            is_active: true
        });

        // Helper to normalize keys (lowercase, trim)
        const normalizeKey = (key) => key.trim().toLowerCase();

        const processRow = (row) => {
            // Flexible matching: find value by loosely matching keys
            const keys = Object.keys(row);
            const getValue = (target) => {
                const key = keys.find(k => normalizeKey(k) === target);
                return key ? row[key] : null;
            };

            const tender_id = getValue('tender_id') || getValue('id') || getValue('reference');
            const department = getValue('department') || getValue('agency') || getValue('dept');
            const vendor = getValue('vendor') || getValue('supplier') || getValue('company');
            const amount = getValue('amount') || getValue('value') || getValue('cost');
            const event_date = getValue('event_date') || getValue('date') || getValue('awarded_on');

            if (tender_id && department && vendor && amount && event_date) {
                return {
                    tender_id,
                    department,
                    vendor,
                    amount: parseFloat(amount),
                    event_date: new Date(event_date),
                    source_file_name: fileName,
                    dataset_id: newDataset._id
                };
            }
            return null;
        };

        if (fileType.includes('csv') || fileName.endsWith('.csv')) {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    const record = processRow(data);
                    if (record) {
                        results.push(record);
                    } else {
                        skippedRecords++;
                    }
                })
                .on('end', async () => {
                    await finalizeUpload(results);
                });
        } else if (fileType.includes('json') || fileName.endsWith('.json')) {
            const rawData = fs.readFileSync(filePath);
            const jsonData = JSON.parse(rawData);

            if (Array.isArray(jsonData)) {
                jsonData.forEach(item => {
                    const record = processRow(item);
                    if (record) {
                        results.push(record);
                    } else {
                        skippedRecords++;
                    }
                });
            }
            await finalizeUpload(results);
        } else {
            fs.unlinkSync(filePath);
            // Revert dataset creation if invalid file
            await Dataset.findByIdAndDelete(newDataset._id);
            return res.status(400).json({ message: 'Invalid file format. Only CSV or JSON allowed.' });
        }

        async function finalizeUpload(records) {
            if (records.length > 0) {
                await ProcurementRecord.insertMany(records);
                validRecords = records.length;

                // Update Dataset Count
                await Dataset.findByIdAndUpdate(newDataset._id, { record_count: validRecords });
            } else {
                // If no valid records, empty dataset shouldn't be active? Or just empty.
                // Keeping it active but empty is fine for "No Data" state.
            }

            // Keep legacy Upload log for history
            const uploadLog = await Upload.create({
                file_name: fileName,
                file_type: fileType.includes('json') ? 'json' : 'csv',
                total_records: validRecords,
                upload_status: 'success'
            });

            // Compute Baselines (Scoped to Dataset? passing null to use old signature or update service?)
            // We need to update computeBaselines to support dataset_id
            if (validRecords > 0) {
                try {
                    await computeBaselines(uploadLog._id, fileName, newDataset._id);
                } catch (err) {
                    console.error('Analytics failed:', err);
                }
            }

            fs.unlinkSync(filePath);

            res.json({
                message: 'Dataset activated successfully',
                dataset_id: newDataset._id,
                dataset_name: newDataset.dataset_name,
                uploaded_at: newDataset.uploaded_at,
                valid_records: validRecords,
                skipped_records: skippedRecords
            });
        }

    } catch (error) {
        console.error(error);
        await Upload.create({
            file_name: fileName,
            file_type: 'unknown',
            total_records: 0,
            upload_status: 'failed'
        });
        res.status(500).json({ message: 'Error processing file: ' + error.message });
    }
};

module.exports = { uploadDataset };
