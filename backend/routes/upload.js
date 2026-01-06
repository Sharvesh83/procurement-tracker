/**
 * Upload Routes
 * 
 * File upload and AI analysis endpoints.
 * Auditors can upload procurement data files for analysis.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const { anyAuthenticatedUser } = require('../middleware/roleGuard');
const { parseFile, validateRecords, generateSummary } = require('../services/fileParser');
const { analyzeData, generateQuickSummary } = require('../services/aiAnalysis');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'));
        }
    }
});

// In-memory storage for uploaded datasets
const uploadedDatasets = new Map();

/**
 * POST /api/upload/analyze
 * Upload and analyze a procurement data file
 */
router.post('/analyze', auth, anyAuthenticatedUser, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILE',
                message: 'No file uploaded'
            });
        }

        const { buffer, mimetype, originalname } = req.file;

        // Parse the file
        let records;
        try {
            records = parseFile(buffer, mimetype, originalname);
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                error: 'PARSE_ERROR',
                message: `Failed to parse file: ${parseError.message}`
            });
        }

        // Validate records
        const { validRecords, errors, warnings } = validateRecords(records);

        if (validRecords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'NO_VALID_RECORDS',
                message: 'No valid records found in file',
                details: { errors, warnings }
            });
        }

        // Generate summary
        const summary = generateSummary(validRecords);

        // Run AI analysis
        const analysis = await analyzeData(summary, validRecords);

        // Store dataset for later access
        const datasetId = `DS-${Date.now()}`;
        uploadedDatasets.set(datasetId, {
            id: datasetId,
            filename: originalname,
            uploaded_at: new Date().toISOString(),
            uploaded_by: req.user._id,
            records: validRecords,
            summary,
            analysis
        });

        res.json({
            success: true,
            message: 'File analyzed successfully',
            data: {
                dataset_id: datasetId,
                filename: originalname,
                summary,
                validation: {
                    total_records: records.length,
                    valid_records: validRecords.length,
                    errors: errors.length,
                    warnings: warnings.length,
                    error_details: errors.slice(0, 10),
                    warning_details: warnings.slice(0, 10)
                },
                analysis
            }
        });

    } catch (error) {
        console.error('Upload analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'ANALYSIS_FAILED',
            message: 'Failed to analyze uploaded file'
        });
    }
});

/**
 * GET /api/upload/datasets
 * List all uploaded datasets
 */
router.get('/datasets', auth, anyAuthenticatedUser, (req, res) => {
    const datasets = Array.from(uploadedDatasets.values()).map(ds => ({
        id: ds.id,
        filename: ds.filename,
        uploaded_at: ds.uploaded_at,
        record_count: ds.records.length,
        summary: {
            tenders: ds.summary.unique_tenders,
            departments: ds.summary.unique_departments,
            suppliers: ds.summary.unique_suppliers,
            total_value: ds.summary.total_contract_value
        }
    }));

    res.json({
        success: true,
        data: {
            datasets,
            count: datasets.length
        }
    });
});

/**
 * GET /api/upload/datasets/:id
 * Get specific dataset with full analysis
 */
router.get('/datasets/:id', auth, anyAuthenticatedUser, (req, res) => {
    const dataset = uploadedDatasets.get(req.params.id);

    if (!dataset) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Dataset not found'
        });
    }

    res.json({
        success: true,
        data: {
            id: dataset.id,
            filename: dataset.filename,
            uploaded_at: dataset.uploaded_at,
            summary: dataset.summary,
            analysis: dataset.analysis,
            records: dataset.records.slice(0, 100) // Limit records returned
        }
    });
});

/**
 * GET /api/upload/datasets/:id/records
 * Get all records from a dataset with pagination
 */
router.get('/datasets/:id/records', auth, anyAuthenticatedUser, (req, res) => {
    const dataset = uploadedDatasets.get(req.params.id);

    if (!dataset) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Dataset not found'
        });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const start = (page - 1) * limit;

    res.json({
        success: true,
        data: {
            records: dataset.records.slice(start, start + limit),
            pagination: {
                page,
                limit,
                total: dataset.records.length,
                pages: Math.ceil(dataset.records.length / limit)
            }
        }
    });
});

/**
 * DELETE /api/upload/datasets/:id
 * Remove a dataset
 */
router.delete('/datasets/:id', auth, anyAuthenticatedUser, (req, res) => {
    const existed = uploadedDatasets.delete(req.params.id);

    if (!existed) {
        return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            message: 'Dataset not found'
        });
    }

    res.json({
        success: true,
        message: 'Dataset removed'
    });
});

// Error handler for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'File exceeds 10MB limit'
            });
        }
    }
    next(error);
});

module.exports = router;
