// Risk Service - Central Logic for "The Brain" of ProcureWatch

const computeRiskScore = (record, baselines) => {
    let riskScore = 0;
    const flags = [];
    const explanations = [];

    // --- 1. Amount-Based Risk Logic ---
    if (baselines) {
        // Find department stats
        const deptStat = baselines.departmentstat.find(ds => ds.department === record.department);

        if (deptStat) {
            // A. Check for Significant Average Deviation (> 200% of Avg)
            if (record.amount > (deptStat.avg_amount * 2)) {
                riskScore += 2; // Moderate to High Risk
                flags.push('High Amount Deviation');
                explanations.push(`Contract amount (${record.amount}) is significantly higher than the department average (${deptStat.avg_amount.toFixed(2)}).`);
            }

            // B. Check for Extreme Median Deviation (> 300% of Median) - Outliers
            if (record.amount > (deptStat.median_amount * 3)) {
                riskScore += 3; // Severe Risk
                flags.push('Extreme Outlier');
                explanations.push(`Contract amount exceeds 3x the department median (${deptStat.median_amount.toFixed(2)}).`);
            }
        }
    }

    // --- 2. Vendor-Based Risk Logic ---
    if (baselines) {
        // Find Vendor Stats
        const vendorStat = baselines.vendorstat.find(v => v.vendor === record.vendor);

        // A. Vendor Dominance Risk (If vendor has > 50% of Dept Spend)
        // Need Dept Total first
        const deptStat = baselines.departmentstat.find(ds => ds.department === record.department);
        if (deptStat && vendorStat) {
            // Heuristic: If this single contract is > 20% of the ENTIRE department's historical average total spend? 
            // Or if vendor's total revenue > 50% of dept total?
            // Since we are processing row by row, let's use the 'baselines' which are aggregate of the CURRENT upload.

            // Check: Does this vendor dominate the current dataset?
            // We'll trust the pre-computed baselines.
            if (vendorStat.total_revenue > (deptStat.total_spend * 0.5)) {
                riskScore += 2;
                flags.push('Vendor Dominance');
                explanations.push(`Vendor ${record.vendor} controls >50% of spend in ${record.department}.`);
            }
        }

        // B. New Vendor High Value (If this is their first win but high value - hard to detect without history DB, skipping for now as per "dataset consistency" focus)
    }

    // --- 3. Timeline/Consistency Logic ---
    // A. Weekend/Holiday Awards
    const date = new Date(record.event_date);
    const day = date.getDay();
    if (day === 0 || day === 6) { // 0=Sun, 6=Sat
        riskScore += 2; // Increased weight for Phase 2
        flags.push('Weekend Activity');
        explanations.push(`Procurement event recorded on a weekend (${date.toDateString()}).`);
    }

    // B. Spend Concentration / Anomalies
    // e.g. Round Number Anomalies (Benford's Law proxy - exact round numbers often suspicious)
    if (record.amount % 1000 === 0 && record.amount > 10000) {
        riskScore += 1;
        flags.push('Round Number Anomaly');
        explanations.push('Amount is a perfect round number, which can be an indicator of manual entry or estimation.');
    }

    // --- 4. Final Scoring Mapping ---
    let riskLevel = 'Low';
    let badgeColor = 'green';

    if (riskScore >= 5) { // Adjusted threshold
        riskLevel = 'High';
        badgeColor = 'red';
    } else if (riskScore >= 3) {
        riskLevel = 'Medium';
        badgeColor = 'amber';
    }

    return {
        score: riskScore,
        level: riskLevel,
        badge: badgeColor,
        flags: flags,
        explanation: explanations.join(' ')
    };
};

module.exports = { computeRiskScore };
