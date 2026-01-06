// Risk Service - DEPRECATED
// This logic has been moved to the Python ML Inference Pipeline (services/ML).
// See: risk_scoring.service.js and risk_model.py

const computeRiskScore = (record, baselines) => {
    console.warn('[DEPRECATED] riskService.computeRiskScore was called. This function is no longer active.');
    return {
        score: 0,
        level: 'Pending',
        badge: 'gray',
        flags: [],
        explanation: 'Risk analysis pending ML inference.'
    };
};

module.exports = { computeRiskScore };
