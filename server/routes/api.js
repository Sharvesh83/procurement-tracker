const express = require('express');
const router = express.Router();
const multer = require('multer');
const { loginUser, registerUser } = require('../controllers/authController');
const { uploadDataset } = require('../controllers/uploadController');
const { getRecords, getUploadHistory, getRecordById } = require('../controllers/recordController');

// Configure Multer
const upload = multer({ dest: 'uploads/' });

// Auth Routes
router.post('/login', loginUser);
router.post('/signup', registerUser);

// Data Routes
router.post('/upload-dataset', upload.single('dataset'), uploadDataset);
router.get('/procurement-records/:id', getRecordById);
router.get('/procurement-records', getRecords);
router.get('/upload-history', getUploadHistory);

// Analytics Routes
// Analytics Routes
const { getAnalyticsSummary, getProcurements, getDashboardCharts } = require('../controllers/recordController');
router.get('/analytics/summary', getAnalyticsSummary);
router.get('/analytics/procurements', getProcurements);
router.get('/analytics/charts', getDashboardCharts);

// Deprecated (Left for safety during migration, verify if safe to remove later)
// router.get('/dashboard-stats', getDashboardStats);

// Dataset Routes
const { getActiveDatasetInfo } = require('../controllers/recordController');
router.get('/datasets/active', getActiveDatasetInfo);

module.exports = router;
