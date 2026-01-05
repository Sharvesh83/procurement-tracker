/**
 * Tender Detail Component
 * 
 * Shows the complete lifecycle of a tender:
 * - Timeline of all events
 * - Risk analysis results
 * - Triggered flags with explanations
 * 
 * This is a READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Clock, AlertTriangle, CheckCircle,
    FileText, Users, DollarSign, Building, Calendar
} from 'lucide-react';
import { eventsAPI, riskAPI } from '../services/api';

function TenderDetail() {
    const { tenderId } = useParams();
    const [events, setEvents] = useState([]);
    const [riskAnalysis, setRiskAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, [tenderId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventsData, riskData] = await Promise.all([
                eventsAPI.getTenderEvents(tenderId),
                riskAPI.analyzeTender(tenderId)
            ]);

            setEvents(eventsData.data?.events || []);
            setRiskAnalysis(riskData.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        if (!amount) return null;
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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getEventIcon = (eventType) => {
        switch (eventType) {
            case 'TENDER_CREATED':
                return <FileText size={16} />;
            case 'BID_SUBMITTED':
                return <Users size={16} />;
            case 'AWARD_GRANTED':
                return <CheckCircle size={16} />;
            case 'PAYMENT_MADE':
                return <DollarSign size={16} />;
            default:
                return <Clock size={16} />;
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading tender details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--color-danger-500)" />
                <h3 style={{ marginTop: '1rem' }}>Error Loading Tender</h3>
                <p>{error}</p>
                <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        color: 'var(--color-gray-600)',
                        marginBottom: 'var(--spacing-md)'
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </Link>
                <h2>Tender: {tenderId}</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    {events.length} events in lifecycle
                </p>
            </div>

            {/* Risk Analysis Summary */}
            {riskAnalysis && (
                <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            <AlertTriangle size={20} />
                            Risk Analysis
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                            <span className={`risk-badge ${riskAnalysis.risk_level?.toLowerCase()}`}>
                                {riskAnalysis.risk_level} RISK
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                {riskAnalysis.risk_score} points
                            </span>
                        </div>
                    </div>

                    <div className="card-body">
                        {riskAnalysis.flags?.length === 0 ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--color-success-50)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <CheckCircle size={24} color="var(--color-success-500)" />
                                <p style={{ margin: 0 }}>No risk flags detected for this tender.</p>
                            </div>
                        ) : (
                            <div>
                                <p style={{
                                    marginBottom: 'var(--spacing-md)',
                                    color: 'var(--color-gray-600)',
                                    fontStyle: 'italic'
                                }}>
                                    {riskAnalysis.disclaimer}
                                </p>

                                {riskAnalysis.flags?.map((flag, index) => (
                                    <div
                                        key={index}
                                        className={`flag-item ${flag.severity?.toLowerCase()}`}
                                    >
                                        <div className="flag-content">
                                            <div className="flag-title">
                                                <span className={`risk-badge ${flag.severity?.toLowerCase()}`}>
                                                    {flag.severity}
                                                </span>
                                                <span style={{ marginLeft: 'var(--spacing-sm)' }}>
                                                    {flag.risk_type?.replace(/_/g, ' ')}
                                                </span>
                                                <span style={{
                                                    marginLeft: 'var(--spacing-sm)',
                                                    color: 'var(--color-gray-500)',
                                                    fontSize: '0.875rem'
                                                }}>
                                                    (+{flag.points} pts)
                                                </span>
                                            </div>
                                            <p className="flag-explanation">{flag.explanation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Clock size={20} />
                        Procurement Lifecycle
                    </h3>
                </div>

                <div className="card-body">
                    <div className="timeline">
                        {events.map((event, index) => (
                            <div key={event.event_id} className="timeline-item completed">
                                <div className="timeline-content">
                                    <div className="timeline-date">{formatDate(event.event_date)}</div>
                                    <div className="timeline-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        {getEventIcon(event.event_type)}
                                        {event.event_type.replace(/_/g, ' ')}
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                        gap: 'var(--spacing-sm)',
                                        marginTop: 'var(--spacing-sm)',
                                        fontSize: '0.875rem',
                                        color: 'var(--color-gray-600)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                            <Building size={14} />
                                            {event.department_id}
                                        </div>

                                        {event.supplier_id && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                                <Users size={14} />
                                                {event.supplier_id}
                                            </div>
                                        )}

                                        {event.bid_count !== null && (
                                            <div>Bids: {event.bid_count}</div>
                                        )}

                                        {event.contract_amount && (
                                            <div style={{ fontWeight: '600', color: 'var(--color-success-600)' }}>
                                                {formatCurrency(event.contract_amount)}
                                            </div>
                                        )}

                                        {event.payment_amount && (
                                            <div style={{ fontWeight: '600', color: 'var(--color-primary-600)' }}>
                                                Payment: {formatCurrency(event.payment_amount)}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{
                                        marginTop: 'var(--spacing-sm)',
                                        fontSize: '0.7rem',
                                        color: 'var(--color-gray-400)',
                                        fontFamily: 'var(--font-mono)'
                                    }}>
                                        Hash: {event.event_hash?.substring(0, 16)}...
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TenderDetail;
