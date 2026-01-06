const mongoose = require('mongoose');

const procurementRecordSchema = new mongoose.Schema({
    dataset_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dataset',
        index: true,
        required: true
    },
    tender_no: {
        type: String,
        required: true,
        index: true
    },
    agency: {
        type: String, // Was department
        required: true,
        index: true
    },
    supplier_name: {
        type: String, // Was vendor
        required: true,
        index: true
    },
    awarded_amt: {
        type: Number, // Was amount
        required: true
    },
    award_date: { // Was event_date
        type: Date,
        required: true
    },
    tender_detail_status: {
        type: String,
        required: false // Might be optional
    },
    source_file_name: {
        type: String,
        required: true
    },
    // Risk Analysis Fields
    risk_score: {
        type: Number,
        default: 0
    },
    risk_level: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Pending'],
        default: 'Pending'
    },
    risk_flags: [String], // e.g. ["High Amount", "Frequent Winner"]
    risk_explanation: String,
    priority: {
        type: String,
        enum: ['High', 'Normal'],
        default: 'Normal'
    }
}, { timestamps: true });

// Compound index for efficient querying
procurementRecordSchema.index({ dataset_id: 1, risk_score: -1 });

module.exports = mongoose.model('ProcurementRecord', procurementRecordSchema);
