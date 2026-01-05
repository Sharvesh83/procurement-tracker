const ProcurementRecord = require('../models/ProcurementRecord');
const DatasetStats = require('../models/DatasetStats');

const calculateMedian = (values) => {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
};

const calculateStdDev = (values, mean) => {
  if (values.length <= 1) return 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};

const computeBaselines = async (uploadId, fileName, datasetId) => {
  console.log(`Computing baselines for upload: ${uploadId} (${fileName}) Dataset: ${datasetId}`);

  // 1. Fetch all records for this DATASET
  const records = await ProcurementRecord.find({ dataset_id: datasetId });

  if (!records || records.length === 0) return null;

  // 2. Compute Department Stats
  const deptMap = {};
  const vendorMap = {};
  const allAmounts = [];

  records.forEach(r => {
    allAmounts.push(r.amount);

    // Dept Stats
    if (!deptMap[r.department]) {
      deptMap[r.department] = { amounts: [], count: 0, sum: 0 };
    }
    deptMap[r.department].amounts.push(r.amount);
    deptMap[r.department].count++;
    deptMap[r.department].sum += r.amount;

    // Vendor Stats
    if (!vendorMap[r.vendor]) {
      vendorMap[r.vendor] = { wins: 0, revenue: 0 };
    }
    vendorMap[r.vendor].wins++;
    vendorMap[r.vendor].revenue += r.amount;
  });

  const deptStats = Object.keys(deptMap).map(dept => {
    const data = deptMap[dept];
    const avg = data.sum / data.count;
    const median = calculateMedian(data.amounts);
    const stdDev = calculateStdDev(data.amounts, avg);

    return {
      department: dept,
      total_spend: data.sum,
      contract_count: data.count,
      avg_amount: avg,
      median_amount: median,
      std_dev_amount: stdDev
    };
  });

  const vendorStats = Object.keys(vendorMap).map(vend => ({
    vendor: vend,
    total_wins: vendorMap[vend].wins,
    total_revenue: vendorMap[vend].revenue
  }));

  const globalAvg = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length;
  const globalMedian = calculateMedian(allAmounts);

  // 3. Store Stats
  const stats = await DatasetStats.create({
    upload_id: uploadId,
    departmentstat: deptStats,
    vendorstat: vendorStats,
    global_avg: globalAvg,
    global_median: globalMedian
  });

  console.log('Baselines computed. Now running Risk Analysis...');

  // 4. Run Risk Scoring for each record
  const { computeRiskScore } = require('./riskService');

  const bulkOps = records.map(record => {
    const riskResult = computeRiskScore(record, stats);
    return {
      updateOne: {
        filter: { _id: record._id },
        update: {
          $set: {
            risk_score: riskResult.score,
            risk_level: riskResult.level,
            risk_flags: riskResult.flags,
            risk_explanation: riskResult.explanation
          }
        }
      }
    };
  });

  if (bulkOps.length > 0) {
    await ProcurementRecord.bulkWrite(bulkOps);
    console.log(`Risk Analysis complete for ${bulkOps.length} records.`);
  }

  return stats;
};

module.exports = { computeBaselines };
