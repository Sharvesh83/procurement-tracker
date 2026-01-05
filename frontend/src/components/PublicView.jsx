/**
 * Public View Component
 * 
 * Public transparency dashboard showing aggregated statistics only.
 * No authentication required.
 * No sensitive supplier or payment details.
 * 
 * READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Shield, BarChart3, Building, FileText,
    Eye, Lock, AlertTriangle, TrendingUp
} from 'lucide-react';
import { dashboardAPI } from '../services/api';

function PublicView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const result = await dashboardAPI.getPublic();
            setData(result.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div className="loading-spinner" style={{ borderTopColor: 'white' }}></div>
                    <p style={{ marginTop: '1rem' }}>Loading public data...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
            {/* Header */}
            <header style={{
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                color: 'white',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <Shield size={48} style={{ marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'white' }}>
                        Public Procurement Monitor
                    </h1>
                    <p style={{ opacity: 0.8, marginBottom: '1.5rem' }}>
                        Transparency Dashboard - Aggregated Statistics
                    </p>
                    <Link
                        to="/login"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            color: 'white'
                        }}
                    >
                        <Lock size={16} />
                        Authorized Login
                    </Link>
                </div>
            </header>

            {/* Disclaimer */}
            <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                padding: '1rem 2rem',
                textAlign: 'center'
            }}>
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} />
                    <strong>IMPORTANT:</strong> {data?.disclaimer || 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.'}
                </p>
            </div>

            {/* Main Content */}
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <BarChart3 size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Total Tenders</h3>
                            <div className="stat-value">{data?.summary?.total_tenders?.toLocaleString() || 0}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Building size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Departments</h3>
                            <div className="stat-value">{data?.summary?.total_departments || 0}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <TrendingUp size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Total Contracts</h3>
                            <div className="stat-value">{data?.financials?.total_contracts?.toLocaleString() || 0}</div>
                        </div>
                    </div>
                </div>

                {/* Financial Summary */}
                {data?.financials && (
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-header">
                            <h3 className="card-title">
                                <TrendingUp size={20} />
                                Financial Overview (Aggregated)
                            </h3>
                        </div>
                        <div className="card-body">
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '1.5rem',
                                textAlign: 'center'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)', marginBottom: '0.5rem' }}>
                                        Total Contract Value
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                                        {formatCurrency(data.financials.total_contract_value)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)', marginBottom: '0.5rem' }}>
                                        Average Contract Value
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-gray-900)' }}>
                                        {formatCurrency(data.financials.average_contract_value)}
                                    </div>
                                </div>
                            </div>
                            <p style={{
                                marginTop: '1rem',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                color: 'var(--color-gray-500)',
                                fontStyle: 'italic'
                            }}>
                                {data.financials.note}
                            </p>
                        </div>
                    </div>
                )}

                {/* Events by Type */}
                {data?.summary?.events_by_type && (
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        <div className="card-header">
                            <h3 className="card-title">
                                <FileText size={20} />
                                Events by Type
                            </h3>
                        </div>
                        <div className="card-body">
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '1rem'
                            }}>
                                {Object.entries(data.summary.events_by_type).map(([type, count]) => (
                                    <div
                                        key={type}
                                        style={{
                                            background: 'var(--color-gray-50)',
                                            padding: '1rem',
                                            borderRadius: 'var(--radius-md)',
                                            textAlign: 'center'
                                        }}
                                    >
                                        <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>{count}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                            {type.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* About Section */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Eye size={20} />
                            About This System
                        </h3>
                    </div>
                    <div className="card-body">
                        <p style={{ marginBottom: '1rem' }}>
                            This public transparency dashboard provides aggregated statistics about government procurement activities.
                            The underlying system is designed with the following principles:
                        </p>
                        <ul style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
                            <li><strong>Observational Only:</strong> The system monitors but does not interfere with procurement</li>
                            <li><strong>Tamper-Evident:</strong> All events are cryptographically hash-chained</li>
                            <li><strong>Deterministic:</strong> No AI or probabilistic models - only rule-based detection</li>
                            <li><strong>Explainable:</strong> Every flag includes a clear human-readable explanation</li>
                            <li><strong>Human-in-the-Loop:</strong> Flags are for review, not autonomous action</li>
                        </ul>
                        <p style={{ marginTop: '1rem', fontStyle: 'italic', color: 'var(--color-gray-600)' }}>
                            For detailed analysis and full event history, authorized personnel can log in to the secure dashboard.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer style={{
                background: 'var(--color-gray-800)',
                color: 'var(--color-gray-400)',
                padding: '2rem',
                textAlign: 'center',
                marginTop: '2rem'
            }}>
                <p>Public Procurement Monitoring System</p>
                {data?.generated_at && (
                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        Data generated at: {new Date(data.generated_at).toLocaleString()}
                    </p>
                )}
            </footer>
        </div>
    );
}

export default PublicView;
