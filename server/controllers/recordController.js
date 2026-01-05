const ProcurementRecord = require('../models/ProcurementRecord');
const Upload = require('../models/Upload');
const Dataset = require('../models/Dataset');

// @desc    Get all procurement records
// @route   GET /api/procurement-records
// @access  Public (or Private)
const getRecords = async (req, res) => {
    try {
        const records = await ProcurementRecord.find({}).sort({ date: -1 });
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get upload history
// @route   GET /api/upload-history
// @access  Public
const getUploadHistory = async (req, res) => {
    try {
        const history = await Upload.find({}).sort({ upload_time: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper to get active dataset
const getActiveDataset = async () => {
    return await Dataset.findOne({ is_active: true });
};

// @desc    Get Active Dataset Info
// @route   GET /api/datasets/active
const getActiveDatasetInfo = async (req, res) => {
    try {
        const activeDataset = await getActiveDataset();
        if (!activeDataset) return res.json(null);
        res.json(activeDataset);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Analytics Summary (Scoped to Active Dataset)
// @route   GET /api/analytics/summary
const getAnalyticsSummary = async (req, res) => {
    try {
        const activeDataset = await getActiveDataset();
        if (!activeDataset) {
            // Return empty stats if no active dataset
            return res.json({
                total_records: 0,
                total_spend: 0,
                high_risk_count: 0
            });
        }

        const matchStage = { $match: { dataset_id: activeDataset._id } };

        // 1. Get Totals
        const totalSpendAgg = await ProcurementRecord.aggregate([
            matchStage,
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalSpend = totalSpendAgg[0]?.total || 0;

        const recordCount = await ProcurementRecord.countDocuments({ dataset_id: activeDataset._id });

        // 2. Risk Counts (Flat structure)
        const riskCounts = await ProcurementRecord.aggregate([
            matchStage,
            { $group: { _id: "$risk_level", count: { $sum: 1 } } }
        ]);

        const getCount = (level) => riskCounts.find(r => r._id === level)?.count || 0;

        // 3. Department Risk Distribution (for charts)
        const deptRiskDist = await ProcurementRecord.aggregate([
            { $match: { dataset_id: activeDataset._id, risk_level: "High" } },
            { $group: { _id: "$department", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // 4. Department Spend
        const deptSpend = await ProcurementRecord.aggregate([
            matchStage,
            { $group: { _id: "$department", total: { $sum: "$amount" } } },
            { $sort: { total: -1 } },
            { $limit: 5 }
        ]);

        // 5. Active Vendors Count
        const uniqueVendors = await ProcurementRecord.distinct('vendor', { dataset_id: activeDataset._id });
        const activeVendors = uniqueVendors.length;

        res.json({
            dataset_name: activeDataset.dataset_name, // Include dataset info
            uploaded_at: activeDataset.uploaded_at,
            total_records: recordCount,
            total_spend: totalSpend,
            low_risk_count: getCount('Low'),
            medium_risk_count: getCount('Medium'),
            high_risk_count: getCount('High'),
            department_risk_distribution: deptRiskDist,
            department_spend: deptSpend,
            active_vendors: activeVendors
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Procurements List with Risk Info (Scoped)
// @route   GET /api/analytics/procurements
const getProcurements = async (req, res) => {
    try {
        const activeDataset = await getActiveDataset();
        if (!activeDataset) return res.json([]);

        const records = await ProcurementRecord.find({ dataset_id: activeDataset._id })
            .select('tender_id department vendor amount event_date risk_score risk_level risk_flags')
            .sort({ risk_score: -1, amount: -1 }) // Sort by risk then amount
            .limit(100);
        res.json(records);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single record by ID
// @route   GET /api/procurement-records/:id
const getRecordById = async (req, res) => {
    try {
        const record = await ProcurementRecord.findById(req.params.id);
        if (record) {
            res.json(record);
        } else {
            res.status(404).json({ message: 'Record not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getRecords, getUploadHistory, getAnalyticsSummary, getProcurements, getRecordById, getActiveDatasetInfo };
