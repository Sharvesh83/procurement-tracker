const mongoose = require('mongoose');

const datasetStatsSchema = new mongoose.Schema({
    upload_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload',
        required: true
    },
    departmentstat: [{
        _id: false,
        department: String,
        total_spend: Number,
        contract_count: Number,
        avg_amount: Number,
        median_amount: Number,
        std_dev_amount: Number
    }],
    vendorstat: [{
        _id: false,
        vendor: String,
        total_wins: Number,
        total_revenue: Number
    }],
    global_avg: Number,
    global_median: Number
}, { timestamps: true });

module.exports = mongoose.model('DatasetStats', datasetStatsSchema);
