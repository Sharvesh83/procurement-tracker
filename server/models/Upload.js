const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    file_name: {
        type: String,
        required: true
    },
    file_type: {
        type: String,
        required: true
    },
    upload_time: {
        type: Date,
        default: Date.now
    },
    total_records: {
        type: Number,
        default: 0
    },
    upload_status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success'
    }
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
