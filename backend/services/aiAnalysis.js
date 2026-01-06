/**
 * AI Analysis Service
 * 
 * Integrates with Google Gemini AI to analyze procurement data
 * and generate risk summaries.
 * 
 * IMPORTANT: This provides AI-generated summaries for HUMAN REVIEW.
 * The AI does NOT make decisions - it highlights patterns for review.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
let genAI = null;
let model = null;

function initializeAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY not set. AI analysis will be disabled.');
        return false;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('Gemini AI initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize Gemini AI:', error.message);
        return false;
    }
}

/**
 * Analyze procurement data and generate risk summary
 */
async function analyzeData(summary, records) {
    if (!model) {
        if (!initializeAI()) {
            return generateFallbackAnalysis(summary, records);
        }
    }

    const prompt = buildAnalysisPrompt(summary, records);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            success: true,
            source: 'GEMINI_AI',
            analysis: parseAIResponse(text),
            raw_response: text,
            generated_at: new Date().toISOString(),
            disclaimer: 'This AI-generated analysis is for HUMAN REVIEW ONLY. It does NOT determine corruption or make accusations. All findings must be verified by qualified personnel.'
        };
    } catch (error) {
        console.error('AI analysis error:', error.message);
        return generateFallbackAnalysis(summary, records);
    }
}

/**
 * Build the analysis prompt
 */
function buildAnalysisPrompt(summary, records) {
    // Sample of records for context (limit to prevent token overflow)
    const sampleRecords = records.slice(0, 20).map(r => ({
        tender_id: r.tender_id,
        event_type: r.event_type,
        department_id: r.department_id,
        supplier_id: r.supplier_id,
        bid_count: r.bid_count,
        contract_amount: r.contract_amount,
        payment_amount: r.payment_amount
    }));

    return `You are an expert procurement analyst. Analyze the following procurement data and identify potential risk patterns for HUMAN REVIEW.

IMPORTANT CONSTRAINTS:
- Do NOT make accusations of corruption or wrongdoing
- Highlight PATTERNS that WARRANT REVIEW, not conclusions
- Be objective and factual
- Focus on statistical anomalies and unusual patterns
- All findings are for human verification

DATA SUMMARY:
- Total Records: ${summary.total_records}
- Unique Tenders: ${summary.unique_tenders}
- Unique Departments: ${summary.unique_departments}
- Unique Suppliers: ${summary.unique_suppliers}
- Total Contract Value: ₹${summary.total_contract_value?.toLocaleString() || 0}
- Total Payments: ₹${summary.total_payments?.toLocaleString() || 0}
- Events by Type: ${JSON.stringify(summary.events_by_type)}

SAMPLE RECORDS (first 20):
${JSON.stringify(sampleRecords, null, 2)}

DEPARTMENTS: ${summary.departments?.join(', ') || 'N/A'}
SUPPLIERS: ${summary.suppliers?.join(', ') || 'N/A'}

Please provide:
1. EXECUTIVE SUMMARY (2-3 sentences overview)
2. KEY RISK INDICATORS (list specific patterns that warrant review)
3. SUPPLIER CONCENTRATION ANALYSIS (any suppliers with unusual patterns)
4. DEPARTMENT ANALYSIS (any departments with unusual patterns)
5. RECOMMENDATIONS FOR REVIEW (specific areas auditors should examine)

Format your response in clear sections with headers.
Remember: This is for PATTERN IDENTIFICATION, not accusations.`;
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(text) {
    const sections = {
        executive_summary: '',
        risk_indicators: [],
        supplier_analysis: '',
        department_analysis: '',
        recommendations: []
    };

    // Simple section extraction
    const lines = text.split('\n');
    let currentSection = 'executive_summary';

    for (const line of lines) {
        const lower = line.toLowerCase();

        if (lower.includes('executive summary') || lower.includes('overview')) {
            currentSection = 'executive_summary';
        } else if (lower.includes('risk indicator') || lower.includes('key risk')) {
            currentSection = 'risk_indicators';
        } else if (lower.includes('supplier')) {
            currentSection = 'supplier_analysis';
        } else if (lower.includes('department')) {
            currentSection = 'department_analysis';
        } else if (lower.includes('recommendation')) {
            currentSection = 'recommendations';
        } else if (line.trim()) {
            if (currentSection === 'risk_indicators' || currentSection === 'recommendations') {
                if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().match(/^\d+\./)) {
                    sections[currentSection].push(line.trim().replace(/^[-•\d.)\s]+/, ''));
                }
            } else if (typeof sections[currentSection] === 'string') {
                sections[currentSection] += line.trim() + ' ';
            }
        }
    }

    // Clean up
    sections.executive_summary = sections.executive_summary.trim();
    sections.supplier_analysis = sections.supplier_analysis.trim();
    sections.department_analysis = sections.department_analysis.trim();

    return sections;
}

/**
 * Generate fallback analysis without AI
 */
function generateFallbackAnalysis(summary, records) {
    const analysis = {
        executive_summary: `Dataset contains ${summary.total_records} procurement records across ${summary.unique_tenders} tenders, ${summary.unique_departments} departments, and ${summary.unique_suppliers} suppliers. Total contract value: ₹${summary.total_contract_value?.toLocaleString() || 0}.`,
        risk_indicators: [],
        supplier_analysis: '',
        department_analysis: '',
        recommendations: []
    };

    // Basic rule-based analysis

    // Low competition check
    const lowBidEvents = records.filter(r => r.bid_count && r.bid_count <= 2);
    if (lowBidEvents.length > 0) {
        analysis.risk_indicators.push(
            `${lowBidEvents.length} events with 2 or fewer bids - potential low competition`
        );
    }

    // Supplier concentration
    const supplierCounts = {};
    records.forEach(r => {
        if (r.supplier_id) {
            supplierCounts[r.supplier_id] = (supplierCounts[r.supplier_id] || 0) + 1;
        }
    });
    const topSupplier = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1])[0];
    if (topSupplier && topSupplier[1] / records.length > 0.3) {
        analysis.risk_indicators.push(
            `Supplier ${topSupplier[0]} appears in ${((topSupplier[1] / records.length) * 100).toFixed(1)}% of records`
        );
        analysis.supplier_analysis = `High concentration detected: ${topSupplier[0]} is involved in ${topSupplier[1]} out of ${records.length} records.`;
    }

    // Department analysis
    const deptCounts = {};
    records.forEach(r => {
        if (r.department_id) {
            deptCounts[r.department_id] = (deptCounts[r.department_id] || 0) + 1;
        }
    });
    const deptList = Object.entries(deptCounts).map(([d, c]) => `${d}: ${c}`).join(', ');
    analysis.department_analysis = `Distribution by department: ${deptList}`;

    // Large contracts
    const largeContracts = records.filter(r => r.contract_amount && r.contract_amount > 1000000);
    if (largeContracts.length > 0) {
        analysis.recommendations.push(
            `Review ${largeContracts.length} contracts exceeding ₹10 lakhs`
        );
    }

    // Payment vs contract mismatch
    const awards = records.filter(r => r.event_type === 'AWARD_GRANTED');
    if (awards.length > 0) {
        analysis.recommendations.push(
            `Verify payment completion for ${awards.length} awarded contracts`
        );
    }

    return {
        success: true,
        source: 'RULE_BASED',
        analysis,
        generated_at: new Date().toISOString(),
        disclaimer: 'This rule-based analysis highlights patterns for HUMAN REVIEW. AI analysis unavailable (GEMINI_API_KEY not configured).'
    };
}

/**
 * Generate quick summary for uploaded file
 */
async function generateQuickSummary(summary) {
    if (!model) {
        return `Uploaded ${summary.total_records} records: ${summary.unique_tenders} tenders, ${summary.unique_departments} departments, ${summary.unique_suppliers} suppliers.`;
    }

    try {
        const prompt = `Provide a one-sentence summary of this procurement data: ${summary.total_records} records, ${summary.unique_tenders} tenders, ${summary.unique_departments} departments, ${summary.unique_suppliers} suppliers, total value ₹${summary.total_contract_value?.toLocaleString() || 0}. Keep it factual and brief.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        return `Uploaded ${summary.total_records} records covering ${summary.unique_tenders} tenders across ${summary.unique_departments} departments.`;
    }
}

module.exports = {
    initializeAI,
    analyzeData,
    generateQuickSummary
};
