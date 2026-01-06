const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
    dataset_name: {
        type: String,
        required: true
    },
    uploaded_at: {
        type: Date,
        default: Date.now
    },
    record_count: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Dataset', datasetSchema);
