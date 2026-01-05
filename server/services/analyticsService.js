const ProcurementRecord = require('../models/ProcurementRecord');

// 1. Get Top Agencies by Spend
exports.getAgencySpend = async (datasetId) => {
  return await ProcurementRecord.aggregate([
    { $match: { dataset_id: datasetId } },
    {
      $group: {
        _id: '$agency',
        total_spend: { $sum: '$awarded_amt' },
        tender_count: { $sum: 1 }
      }
    },
    { $sort: { total_spend: -1 } },
    { $limit: 10 }
  ]);
};

// 2. Get Top Suppliers by Spend
exports.getSupplierDominance = async (datasetId) => {
  return await ProcurementRecord.aggregate([
    { $match: { dataset_id: datasetId } },
    {
      $group: {
        _id: '$supplier_name',
        total_won: { $sum: '$awarded_amt' },
        wins_count: { $sum: 1 }
      }
    },
    { $sort: { total_won: -1 } },
    { $limit: 10 }
  ]);
};

// 3. Risk Profile Distribution
exports.getRiskProfile = async (datasetId) => {
  return await ProcurementRecord.aggregate([
    { $match: { dataset_id: datasetId } },
    {
      $group: {
        _id: '$risk_level',
        count: { $sum: 1 },
        total_value: { $sum: '$awarded_amt' }
      }
    }
  ]);
};
