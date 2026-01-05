import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';

import { Search, Filter, ChevronLeft, ChevronRight, AlertCircle, X, ChevronDown } from 'lucide-react';
import './Dashboard.css'; // Reusing dashboard styles for table
import Button from '../components/Button';
import './Records.css';
import './RecordsOverrides.css';

export default function Records() {
    const [records, setRecords] = useState([]);
    const [metadata, setMetadata] = useState({ total: 0, page: 1, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [riskLevel, setRiskLevel] = useState('');

    const fetchRecords = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: 10,
                search,
                risk_level: riskLevel
            });
            const response = await fetch(`/api/procurement-records?${params}`);
            const data = await response.json();
            setRecords(data.records);
            setMetadata({ total: data.total, page: data.page, pages: data.pages });
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRecords(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, riskLevel]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= metadata.pages) {
            fetchRecords(newPage);
        }
    };

    const getRiskClass = (level) => {
        switch (level) {
            case 'High': return 'risk-pill high';
            case 'Medium': return 'risk-pill medium';
            default: return 'risk-pill low';
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>Procurement Records</h1>
                    <p>Search and Audit Contracts</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="records-toolbar">
                <div className="search-field">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by ID, agency, or vendor"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            className="clear-btn"
                            aria-label="Clear search"
                            onClick={() => setSearch('')}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="filters">
                    <div className="select">
                        <Filter size={16} className="leading-icon" />
                        <select
                            value={riskLevel}
                            onChange={(e) => setRiskLevel(e.target.value)}
                        >
                            <option value="">All risks</option>
                            <option value="High">High risk</option>
                            <option value="Medium">Medium risk</option>
                            <option value="Low">Low risk</option>
                        </select>
                        <ChevronDown size={14} className="trailing-icon" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-wrapper">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading records...</div>
                ) : records.length > 0 ? (
                    <table className="risk-table">
                        <thead>
                            <tr>
                                <th>Tender No</th>
                                <th>Agency</th>
                                <th>Supplier</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Risk Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => (
                                <tr key={record._id} className="hover:bg-gray-50">
                                    <td className="font-mono text-xs">{record.tender_no}</td>
                                    <td>{record.agency}</td>
                                    <td className="font-medium">{record.supplier_name}</td>
                                    <td>${record.awarded_amt.toLocaleString()}</td>
                                    <td className="text-sm text-gray-500">{new Date(record.award_date).toLocaleDateString()}</td>
                                    <td>
                                        <span className={getRiskClass(record.risk_level)}>
                                            {record.risk_level}
                                        </span>
                                        {record.risk_level === 'High' && (
                                            <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded inline-block">
                                                {record.risk_flags[0]}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <AlertCircle size={28} />
                        </div>
                        <div className="empty-text">
                            <h3>No records found</h3>
                            <p>Try a different search or adjust your filters.</p>
                        </div>
                        <div className="empty-actions">
                            <Button variant="outlined" onClick={() => { setSearch(''); setRiskLevel(''); fetchRecords(1); }}>
                                Reset filters
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && records.length > 0 && (
                <div className="flex justify-between items-center mt-6">
                    <span className="text-sm text-gray-500">
                        Page {metadata.page} of {metadata.pages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => handlePageChange(metadata.page - 1)}
                            disabled={metadata.page === 1}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            onClick={() => handlePageChange(metadata.page + 1)}
                            disabled={metadata.page === metadata.pages}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
