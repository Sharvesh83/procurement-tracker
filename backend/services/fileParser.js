/**
 * File Parser Service
 * 
 * Parses uploaded CSV and Excel files containing procurement data.
 * Converts to standardized event format for analysis.
 */

const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { EVENT_TYPES } = require('../config/constants');

/**
 * Parse file buffer based on mimetype
 */
function parseFile(buffer, mimetype, filename) {
    if (mimetype === 'text/csv' || filename.endsWith('.csv')) {
        return parseCSV(buffer);
    } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimetype === 'application/vnd.ms-excel' ||
        filename.endsWith('.xlsx') ||
        filename.endsWith('.xls')
    ) {
        return parseExcel(buffer);
    } else {
        throw new Error(`Unsupported file type: ${mimetype}`);
    }
}

/**
 * Parse CSV buffer to records
 */
function parseCSV(buffer) {
    const content = buffer.toString('utf-8');
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true
    });
    return normalizeRecords(records);
}

/**
 * Parse Excel buffer to records
 */
function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet);
    return normalizeRecords(records);
}

/**
 * Normalize records to standard format
 * Supports various column naming conventions
 */
function normalizeRecords(records) {
    return records.map((record, index) => {
        // Map common column name variations
        const normalized = {
            row_number: index + 1,
            tender_id: getField(record, ['tender_id', 'TenderID', 'Tender ID', 'tender', 'id']),
            event_type: normalizeEventType(getField(record, ['event_type', 'EventType', 'Event Type', 'type', 'event'])),
            department_id: getField(record, ['department_id', 'DepartmentID', 'Department ID', 'department', 'dept']),
            supplier_id: getField(record, ['supplier_id', 'SupplierID', 'Supplier ID', 'supplier', 'vendor']),
            bid_count: parseNumber(getField(record, ['bid_count', 'BidCount', 'Bid Count', 'bids', 'number_of_bids'])),
            award_rank: parseNumber(getField(record, ['award_rank', 'AwardRank', 'Award Rank', 'rank'])),
            contract_amount: parseNumber(getField(record, ['contract_amount', 'ContractAmount', 'Contract Amount', 'amount', 'value', 'contract_value'])),
            payment_amount: parseNumber(getField(record, ['payment_amount', 'PaymentAmount', 'Payment Amount', 'payment'])),
            event_date: parseDate(getField(record, ['event_date', 'EventDate', 'Event Date', 'date', 'Date'])),
            description: getField(record, ['description', 'Description', 'notes', 'Notes', 'remarks']),
            raw: record
        };

        return normalized;
    });
}

/**
 * Get field value from record with multiple possible keys
 */
function getField(record, keys) {
    for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
            return record[key];
        }
    }
    return null;
}

/**
 * Normalize event type string
 */
function normalizeEventType(type) {
    if (!type) return null;

    const normalized = type.toString().toUpperCase().replace(/\s+/g, '_');

    // Map common variations
    const mappings = {
        'TENDER': EVENT_TYPES.TENDER_CREATED,
        'TENDER_CREATED': EVENT_TYPES.TENDER_CREATED,
        'CREATE': EVENT_TYPES.TENDER_CREATED,
        'BID': EVENT_TYPES.BID_SUBMITTED,
        'BID_SUBMITTED': EVENT_TYPES.BID_SUBMITTED,
        'SUBMITTED': EVENT_TYPES.BID_SUBMITTED,
        'AWARD': EVENT_TYPES.AWARD_GRANTED,
        'AWARD_GRANTED': EVENT_TYPES.AWARD_GRANTED,
        'GRANTED': EVENT_TYPES.AWARD_GRANTED,
        'PAYMENT': EVENT_TYPES.PAYMENT_MADE,
        'PAYMENT_MADE': EVENT_TYPES.PAYMENT_MADE,
        'PAID': EVENT_TYPES.PAYMENT_MADE
    };

    return mappings[normalized] || normalized;
}

/**
 * Parse number from various formats
 */
function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;

    // Remove currency symbols, commas, spaces
    const cleaned = value.toString().replace(/[₹$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Parse date from various formats
 */
function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;

    // Try parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;

    // Try DD/MM/YYYY format
    const parts = value.toString().split(/[\/\-]/);
    if (parts.length === 3) {
        const [d, m, y] = parts;
        const date = new Date(y, m - 1, d);
        if (!isNaN(date.getTime())) return date;
    }

    return null;
}

/**
 * Validate parsed records
 */
function validateRecords(records) {
    const errors = [];
    const warnings = [];
    const validRecords = [];

    for (const record of records) {
        const rowErrors = [];

        // Required fields
        if (!record.tender_id) {
            rowErrors.push('Missing tender_id');
        }
        if (!record.department_id) {
            rowErrors.push('Missing department_id');
        }

        // Warnings
        if (!record.event_type) {
            warnings.push(`Row ${record.row_number}: No event type, will use default`);
            record.event_type = EVENT_TYPES.TENDER_CREATED;
        }
        if (!record.event_date) {
            warnings.push(`Row ${record.row_number}: No date, will use current`);
            record.event_date = new Date();
        }

        if (rowErrors.length > 0) {
            errors.push({ row: record.row_number, errors: rowErrors });
        } else {
            validRecords.push(record);
        }
    }

    return { validRecords, errors, warnings };
}

/**
 * Convert parsed records to event format
 */
function convertToEvents(records, enteredBy) {
    return records.map(record => ({
        event_id: uuidv4(),
        tender_id: record.tender_id,
        event_type: record.event_type,
        department_id: record.department_id,
        supplier_id: record.supplier_id,
        bid_count: record.bid_count,
        award_rank: record.award_rank,
        contract_amount: record.contract_amount,
        payment_amount: record.payment_amount,
        event_date: record.event_date,
        entered_by: enteredBy,
        source: 'FILE_UPLOAD'
    }));
}

/**
 * Generate summary statistics from parsed records
 */
function generateSummary(records) {
    const tenders = new Set(records.map(r => r.tender_id).filter(Boolean));
    const departments = new Set(records.map(r => r.department_id).filter(Boolean));
    const suppliers = new Set(records.map(r => r.supplier_id).filter(Boolean));

    const totalContractValue = records
        .filter(r => r.contract_amount)
        .reduce((sum, r) => sum + r.contract_amount, 0);

    const totalPayments = records
        .filter(r => r.payment_amount)
        .reduce((sum, r) => sum + r.payment_amount, 0);

    const eventTypes = {};
    records.forEach(r => {
        if (r.event_type) {
            eventTypes[r.event_type] = (eventTypes[r.event_type] || 0) + 1;
        }
    });

    return {
        total_records: records.length,
        unique_tenders: tenders.size,
        unique_departments: departments.size,
        unique_suppliers: suppliers.size,
        total_contract_value: totalContractValue,
        total_payments: totalPayments,
        events_by_type: eventTypes,
        tenders: [...tenders],
        departments: [...departments],
        suppliers: [...suppliers]
    };
}

module.exports = {
    parseFile,
    parseCSV,
    parseExcel,
    validateRecords,
    convertToEvents,
    generateSummary
};
