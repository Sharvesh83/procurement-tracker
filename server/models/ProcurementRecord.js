const mongoose = require('mongoose');

const procurementRecordSchema = new mongoose.Schema({
    tender_id: {
        type: String,
        required: true,
        index: true
    },
    dataset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dataset',
        index: true
    },
    department: {
        type: String,
        required: true
    },
    vendor: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    event_date: {
        type: Date,
        required: true
    },
    uploaded_at: {
        type: Date,
        default: Date.now
    },
    source_file_name: {
        type: String,
        required: true
    },
    risk_score: {
        type: Number,
        default: 0
    },
    risk_level: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Low'
    },
    risk_flags: [String],
    risk_explanation: String
}, { timestamps: true });

module.exports = mongoose.model('ProcurementRecord', procurementRecordSchema);
