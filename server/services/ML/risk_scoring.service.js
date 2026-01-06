const { spawn } = require('child_process');
const path = require('path');
const ProcurementRecord = require('../../models/ProcurementRecord');
const Dataset = require('../../models/Dataset');

/**
 * Triggers the Python ML Inference process for a given dataset.
 * Updates records in the database with the resulting scores.
 */
exports.processDataset = async (datasetId) => {
    console.log(`[ML] Starting risk scoring for dataset: ${datasetId}`);

    try {
        // 1. Fetch Records
        const records = await ProcurementRecord.find({ dataset_id: datasetId }).lean();

        if (records.length === 0) {
            console.log('[ML] No records found to process.');
            return { success: true, count: 0 };
        }

        // 2. Prepare Data for Python
        // We only need specific fields for features
        const inputData = records.map(r => ({
            _id: r._id.toString(),
            awarded_amt: r.awarded_amt,
            tender_detail_status: r.tender_detail_status,
            // Add other fields if risk_model uses them
            vendor: r.supplier_name,
            department: r.agency
        }));

        // 3. Spawn Python Process
        // Use 'inference.py' relative to CWD, or absolute path. 
        // Setting CWD to __dirname ensures imports work correctly.
        const pythonProcess = spawn('python', ['inference.py'], { cwd: __dirname });

        let resultString = '';
        let errorString = '';

        const promise = new Promise((resolve, reject) => {
            // Handle spawn errors (e.g., python not found)
            pythonProcess.on('error', (err) => {
                console.error('[ML] Failed to start Python process:', err);
                reject(new Error(`Failed to start Python process: ${err.message}`));
            });

            // Handle pipeline errors
            pythonProcess.stdin.on('error', (err) => {
                // This usually happens if Python exits before we finish writing
                console.error('[ML] Error writing to Python stdin:', err);
                // We don't reject here immediately, we let the process exit handler report the stderr
            });

            pythonProcess.stdout.on('data', (data) => {
                resultString += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorString += data.toString();
                // console.error(`[ML Error] ${data}`);
            });

            pythonProcess.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`[ML] Process exited with code ${code}. Stderr: ${errorString}`);
                    // Fallback: If ML fails, we don't want to crash the request.
                    // We can resolve with success=false, or reject.
                    // Given checking "write EOF", likely Python script crashed on import or logic.
                    return reject(new Error(`ML Process Failed (Code ${code}): ${errorString}`));
                }

                try {
                    // 4. Parse Results
                    if (!resultString) {
                        return reject(new Error('ML Process returned no output'));
                    }
                    const predictions = JSON.parse(resultString);

                    if (predictions.error) {
                        return reject(new Error(predictions.error));
                    }

                    // 5. Bulk Update DB
                    // predictions array index corresponds to inputData index
                    // OR we can map by ID if we passed it. The Python script currently returns a list.
                    // RiskModel.predict returns a list of results.
                    // We assume valid 1-to-1 mapping if order is preserved.
                    // For safety, let's verify lengths.

                    if (predictions.length !== records.length) {
                        console.warn(`[ML] Mismatch in prediction count. Sent ${records.length}, got ${predictions.length}`);
                    }

                    const bulkOps = predictions.map((pred, index) => {
                        return {
                            updateOne: {
                                filter: { _id: records[index]._id },
                                update: {
                                    $set: {
                                        risk_score: pred.risk_score,
                                        risk_level: pred.risk_level,
                                        risk_flags: pred.risk_flags, // Ensure schema supports array
                                        risk_explanation: pred.risk_flags.join(', '), // Legacy field support
                                        priority: pred.priority // New ML-driven priority
                                    }
                                }
                            }
                        };
                    });

                    if (bulkOps.length > 0) {
                        await ProcurementRecord.bulkWrite(bulkOps);
                    }

                    // 6. Update Dataset Status (Optional, if we had a status field)
                    console.log(`[ML] Successfully scored ${bulkOps.length} records.`);
                    resolve({ success: true, count: bulkOps.length });

                } catch (parseError) {
                    reject(new Error(`Failed to parse ML output: ${parseError.message}. Raw output: ${resultString}`));
                }
            });
        });

        // Write data to stdin safely
        try {
            pythonProcess.stdin.write(JSON.stringify(inputData));
            pythonProcess.stdin.end();
        } catch (writeError) {
            console.error('[ML] Error writing data to Python process:', writeError);
        }

        return await promise;

    } catch (error) {
        console.error('[ML] Service Error:', error);
        throw error;
    }
};
