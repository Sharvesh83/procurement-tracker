import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, FileText, Calendar, Building, DollarSign } from 'lucide-react';
import Button from '../components/Button';
import './RecordDetail.css';

export default function RecordDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/procurement-records/${id}`)
            .then(res => res.json())
            .then(data => {
                setRecord(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="p-8">Loading Record...</div>;
    if (!record) return <div className="p-8">Record not found.</div>;

    const isHighRisk = record.risk_level === 'High';
    const isMediumRisk = record.risk_level === 'Medium';

    return (
        <div className="detail-container">
            <Button variant="text" onClick={() => navigate(-1)} className="back-btn">
                <ArrowLeft size={20} /> Back to List
            </Button>

            <header className="detail-header">
                <div className="header-left">
                    <span className="tender-id-label">Tender ID: {record.tender_id}</span>
                </div>
                <span className={`status-badge ${record.risk_level.toLowerCase()}`}>
                    {isHighRisk ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    Risk Level: {record.risk_level} ({record.risk_score} Pts)
                </span>
            </header>

            <div className="detail-grid">
                {/* Main Info Card */}
                <div className="info-card main">
                    <h2>Procurement Details</h2>
                    <div className="field-row">
                        <div className="field">
                            <label><Building size={16} /> Department</label>
                            <span>{record.department}</span>
                        </div>
                        <div className="field">
                            <label><Building size={16} /> Vendor</label>
                            <span>{record.vendor}</span>
                        </div>
                    </div>
                    <div className="field-row">
                        <div className="field">
                            <label><DollarSign size={16} /> Contract Amount</label>
                            <span className="amount">${record.amount.toLocaleString()}</span>
                        </div>
                        <div className="field">
                            <label><Calendar size={16} /> Event Date</label>
                            <span>{new Date(record.event_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="field-row">
                        <div className="field full">
                            <label><FileText size={16} /> Source File</label>
                            <span>{record.source_file_name}</span>
                        </div>
                    </div>
                </div>

                {/* Risk Analysis Card */}
                <div className={`info-card risk-analysis ${isHighRisk ? 'high-risk-border' : ''}`}>
                    <h2>Risk Analysis & Explanation</h2>

                    {record.risk_score === 0 ? (
                        <div className="safe-state">
                            <CheckCircle size={48} color="var(--primary)" />
                            <p>No risk indicators were flagged for this procurement. It aligns with historical baselines.</p>
                        </div>
                    ) : (
                        <div className="risk-details">
                            <div className="flags-section">
                                <h3>Triggered Flags ({record.risk_flags.length})</h3>
                                <div className="flags-list">
                                    {record.risk_flags.map((flag, i) => (
                                        <span key={i} className="flag-chip">{flag}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="explanation-section">
                                <h3>AI/Logic Explanation</h3>
                                <p className="explanation-text">
                                    {record.risk_explanation || "Automated analysis detected anomalies based on standard deviation and vendor history logic."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
