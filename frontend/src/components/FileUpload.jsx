/**
 * File Upload Component
 * 
 * Allows authenticated users to upload CSV/Excel files
 * for procurement data analysis with AI-powered risk summaries.
 */

import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Loader, BarChart3, Building, Users, TrendingUp } from 'lucide-react';

const API_BASE = '/api';

function FileUpload() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setResult(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            setError(null);
            setResult(null);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/upload/analyze`, {
                method: 'POST',
                headers: {
                    ...(token && { Authorization: `Bearer ${token}` })
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            setResult(data.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const formatCurrency = (amount) => {
        if (!amount) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={28} />
                File Upload & AI Analysis
            </h1>

            <p style={{ color: 'var(--color-gray-600)', marginBottom: '2rem' }}>
                Upload procurement data files (CSV or Excel) for automated risk analysis.
            </p>

            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed var(--color-gray-300)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '3rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: file ? 'var(--color-success-50)' : 'var(--color-gray-50)',
                    transition: 'all 0.2s'
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                {file ? (
                    <div>
                        <FileText size={48} color="var(--color-success-600)" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ fontWeight: '600', color: 'var(--color-success-700)' }}>{file.name}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
                            {(file.size / 1024).toFixed(1)} KB
                        </p>
                    </div>
                ) : (
                    <div>
                        <Upload size={48} color="var(--color-gray-400)" style={{ margin: '0 auto 1rem' }} />
                        <p style={{ fontWeight: '600' }}>Drop your file here or click to browse</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>
                            Supports CSV, XLSX, XLS (max 10MB)
                        </p>
                    </div>
                )}
            </div>

            {/* Upload Button */}
            {file && !result && (
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    style={{
                        marginTop: '1rem',
                        padding: '0.75rem 2rem',
                        background: uploading ? 'var(--color-gray-400)' : 'var(--color-primary-600)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '1rem',
                        fontWeight: '600'
                    }}
                >
                    {uploading ? (
                        <>
                            <Loader size={18} className="spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <BarChart3 size={18} />
                            Analyze File
                        </>
                    )}
                </button>
            )}

            {/* Error */}
            {error && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'var(--color-danger-50)',
                    border: '1px solid var(--color-danger-200)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-danger-700)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div style={{ marginTop: '2rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        color: 'var(--color-success-700)'
                    }}>
                        <CheckCircle size={24} />
                        <h2 style={{ margin: 0 }}>Analysis Complete</h2>
                    </div>

                    {/* Summary Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        marginBottom: '2rem'
                    }}>
                        <div className="stat-card">
                            <div className="stat-icon primary"><FileText size={20} /></div>
                            <div className="stat-content">
                                <h3>Records</h3>
                                <div className="stat-value">{result.summary.total_records}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon success"><BarChart3 size={20} /></div>
                            <div className="stat-content">
                                <h3>Tenders</h3>
                                <div className="stat-value">{result.summary.unique_tenders}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon warning"><Building size={20} /></div>
                            <div className="stat-content">
                                <h3>Departments</h3>
                                <div className="stat-value">{result.summary.unique_departments}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Users size={20} /></div>
                            <div className="stat-content">
                                <h3>Suppliers</h3>
                                <div className="stat-value">{result.summary.unique_suppliers}</div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    {result.summary.total_contract_value > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <h3 className="card-title">
                                    <TrendingUp size={20} />
                                    Financial Summary
                                </h3>
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>Total Contract Value</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(result.summary.total_contract_value)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>Total Payments</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(result.summary.total_payments)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI Analysis */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <h3 className="card-title">
                                <BarChart3 size={20} />
                                Risk Analysis
                                <span style={{
                                    marginLeft: '0.5rem',
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    background: result.analysis.source === 'GEMINI_AI' ? 'var(--color-primary-100)' : 'var(--color-gray-100)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontWeight: 'normal'
                                }}>
                                    {result.analysis.source === 'GEMINI_AI' ? '🤖 AI-Powered' : '📊 Rule-Based'}
                                </span>
                            </h3>
                        </div>
                        <div className="card-body">
                            {/* Executive Summary */}
                            {result.analysis.analysis?.executive_summary && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-gray-700)' }}>Executive Summary</h4>
                                    <p style={{ color: 'var(--color-gray-600)', lineHeight: '1.6' }}>
                                        {result.analysis.analysis.executive_summary}
                                    </p>
                                </div>
                            )}

                            {/* Risk Indicators */}
                            {result.analysis.analysis?.risk_indicators?.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-gray-700)' }}>Key Risk Indicators</h4>
                                    <ul style={{ paddingLeft: '1.25rem' }}>
                                        {result.analysis.analysis.risk_indicators.map((indicator, i) => (
                                            <li key={i} style={{ marginBottom: '0.5rem', color: 'var(--color-warning-700)' }}>
                                                <AlertTriangle size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                                {indicator}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Recommendations */}
                            {result.analysis.analysis?.recommendations?.length > 0 && (
                                <div>
                                    <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-gray-700)' }}>Recommendations for Review</h4>
                                    <ul style={{ paddingLeft: '1.25rem' }}>
                                        {result.analysis.analysis.recommendations.map((rec, i) => (
                                            <li key={i} style={{ marginBottom: '0.5rem', color: 'var(--color-gray-600)' }}>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Disclaimer */}
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                background: 'var(--color-warning-50)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.875rem',
                                color: 'var(--color-warning-800)'
                            }}>
                                <AlertTriangle size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                {result.analysis.disclaimer}
                            </div>
                        </div>
                    </div>

                    {/* Upload Another */}
                    <button
                        onClick={() => {
                            setFile(null);
                            setResult(null);
                        }}
                        style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--color-gray-100)',
                            border: '1px solid var(--color-gray-300)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer'
                        }}
                    >
                        Upload Another File
                    </button>
                </div>
            )}
        </div>
    );
}

export default FileUpload;
