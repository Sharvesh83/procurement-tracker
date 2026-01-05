/**
 * Dashboard Component
 * 
 * Main overview dashboard showing:
 * - Key procurement statistics
 * - Recent events
 * - High-risk tenders
 * 
 * This is a READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3, FileText, Building, Users,
    AlertTriangle, TrendingUp, Clock, DollarSign,
    ChevronRight
} from 'lucide-react';
import { dashboardAPI, eventsAPI } from '../services/api';

function Dashboard() {
    const [overview, setOverview] = useState(null);
    const [recentEvents, setRecentEvents] = useState([]);
    const [highRiskTenders, setHighRiskTenders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [overviewData, recentData, riskData] = await Promise.all([
                dashboardAPI.getOverview(),
                eventsAPI.getRecent(5),
                dashboardAPI.getHighRiskTenders(5)
            ]);

            setOverview(overviewData.data);
            setRecentEvents(recentData.data?.events || []);
            setHighRiskTenders(riskData.data?.tenders || []);
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

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center', color: 'var(--color-danger-500)' }}>
                <AlertTriangle size={48} />
                <h3 style={{ marginTop: '1rem' }}>Error Loading Dashboard</h3>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={fetchData} style={{ marginTop: '1rem' }}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2>Procurement Overview</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    Real-time monitoring of public procurement activities
                </p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon primary">
                        <FileText size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Events</h3>
                        <div className="stat-value">{overview?.events?.total?.toLocaleString() || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <BarChart3 size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Tenders</h3>
                        <div className="stat-value">{overview?.tenders?.total?.toLocaleString() || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon warning">
                        <Building size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Departments</h3>
                        <div className="stat-value">{overview?.entities?.departments || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon primary">
                        <Users size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Suppliers</h3>
                        <div className="stat-value">{overview?.entities?.suppliers || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <DollarSign size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>Total Contract Value</h3>
                        <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                            {formatCurrency(overview?.financials?.total_contract_value)}
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon danger">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="stat-content">
                        <h3>High Risk (30 days)</h3>
                        <div className="stat-value">{overview?.tenders?.high_risk_recent || 0}</div>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-xl)' }}>

                {/* Recent Events */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Clock size={20} />
                            Recent Events
                        </h3>
                        <Link to="/" className="btn btn-outline" style={{ fontSize: '0.75rem' }}>
                            View All
                        </Link>
                    </div>
                    <div className="card-body">
                        {recentEvents.length === 0 ? (
                            <div className="empty-state">
                                <p>No events recorded yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {recentEvents.map((event) => (
                                    <Link
                                        key={event.event_id}
                                        to={`/tender/${event.tender_id}`}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: 'var(--color-gray-50)',
                                            borderRadius: 'var(--radius-md)',
                                            textDecoration: 'none',
                                            color: 'inherit'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                                                {event.event_type.replace(/_/g, ' ')}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                                {event.tender_id} • {event.department_id}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                                {formatDate(event.event_date)}
                                            </div>
                                            <ChevronRight size={16} color="var(--color-gray-400)" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* High Risk Tenders */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <AlertTriangle size={20} color="var(--color-danger-500)" />
                            Tenders Requiring Review
                        </h3>
                    </div>
                    <div className="card-body">
                        {highRiskTenders.length === 0 ? (
                            <div className="empty-state">
                                <p>No risk flags detected</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                {highRiskTenders.map((tender) => (
                                    <Link
                                        key={tender.tender_id}
                                        to={`/tender/${tender.tender_id}`}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-sm) var(--spacing-md)',
                                            background: tender.risk_level === 'HIGH'
                                                ? 'var(--color-danger-50)'
                                                : tender.risk_level === 'MEDIUM'
                                                    ? 'var(--color-warning-50)'
                                                    : 'var(--color-gray-50)',
                                            borderRadius: 'var(--radius-md)',
                                            borderLeft: `3px solid ${tender.risk_level === 'HIGH'
                                                    ? 'var(--color-danger-500)'
                                                    : tender.risk_level === 'MEDIUM'
                                                        ? 'var(--color-warning-500)'
                                                        : 'var(--color-gray-300)'
                                                }`,
                                            textDecoration: 'none',
                                            color: 'inherit'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                                                {tender.tender_id}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                                {tender.flags?.length || 0} flags detected
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                            <span className={`risk-badge ${tender.risk_level?.toLowerCase()}`}>
                                                {tender.risk_level}
                                            </span>
                                            <span style={{
                                                fontWeight: '600',
                                                color: 'var(--color-gray-700)',
                                                fontSize: '0.875rem'
                                            }}>
                                                {tender.risk_score} pts
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
