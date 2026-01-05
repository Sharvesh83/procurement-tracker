/**
 * Risk Rules Component
 * 
 * Displays documentation of all risk detection rules.
 * Provides full transparency about how risks are detected.
 * 
 * READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { riskAPI } from '../services/api';

function RiskRules() {
    const [rulesData, setRulesData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRule, setExpandedRule] = useState(null);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            setLoading(true);
            const data = await riskAPI.getRules();
            setRulesData(data.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'HIGH': return 'danger';
            case 'MEDIUM': return 'warning';
            case 'LOW': return 'success';
            default: return 'primary';
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading risk rules...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--color-danger-500)" />
                <h3 style={{ marginTop: '1rem' }}>Error Loading Rules</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2>Risk Detection Rules</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    Complete transparency about how procurement patterns are analyzed
                </p>
            </div>

            {/* Disclaimer */}
            <div className="disclaimer-banner" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <p>
                    <Info size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    {rulesData?.disclaimer}
                </p>
            </div>

            {/* Scoring Explanation */}
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <BookOpen size={20} />
                        Risk Scoring System
                    </h3>
                </div>
                <div className="card-body">
                    <p style={{ marginBottom: 'var(--spacing-md)' }}>
                        Risk scores are calculated by summing the points from all triggered flags:
                    </p>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-success-50)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-success-600)' }}>
                                {rulesData?.scoring?.low_points} pts
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-success-600)' }}>LOW</div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-warning-50)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-warning-600)' }}>
                                {rulesData?.scoring?.medium_points} pts
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-warning-600)' }}>MEDIUM</div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-danger-50)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-danger-600)' }}>
                                {rulesData?.scoring?.high_points} pts
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-danger-600)' }}>HIGH</div>
                        </div>
                    </div>

                    <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Score Interpretation:</h4>
                    <ul style={{ paddingLeft: 'var(--spacing-lg)', lineHeight: '1.8' }}>
                        <li>{rulesData?.scoring?.interpretation?.low}</li>
                        <li>{rulesData?.scoring?.interpretation?.medium}</li>
                        <li>{rulesData?.scoring?.interpretation?.high}</li>
                    </ul>
                </div>
            </div>

            {/* Rules List */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <AlertTriangle size={20} />
                        Detection Rules ({rulesData?.rules?.length || 0})
                    </h3>
                </div>
                <div className="card-body">
                    {rulesData?.rules?.map((rule, index) => (
                        <div
                            key={rule.id}
                            style={{
                                border: '1px solid var(--color-gray-200)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-md)',
                                overflow: 'hidden'
                            }}
                        >
                            <div
                                onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: 'var(--spacing-md)',
                                    cursor: 'pointer',
                                    background: 'var(--color-gray-50)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <span className={`risk-badge ${getSeverityColor(rule.severity)}`}>
                                        {rule.severity}
                                    </span>
                                    <strong>{rule.name}</strong>
                                    <span style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
                                        (+{rule.points} pts)
                                    </span>
                                </div>
                                {expandedRule === rule.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>

                            {expandedRule === rule.id && (
                                <div style={{ padding: 'var(--spacing-lg)', borderTop: '1px solid var(--color-gray-200)' }}>
                                    <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-gray-700)' }}>
                                        {rule.description}
                                    </p>

                                    <div style={{
                                        background: 'var(--color-gray-50)',
                                        padding: 'var(--spacing-md)',
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 'var(--spacing-md)'
                                    }}>
                                        <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Detection Logic:</h5>
                                        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                                            {rule.logic}
                                        </p>
                                    </div>

                                    <h5 style={{ marginBottom: 'var(--spacing-sm)' }}>Parameters:</h5>
                                    <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                        <tbody>
                                            {Object.entries(rule.parameters || {}).map(([key, value]) => (
                                                <tr key={key}>
                                                    <td style={{ padding: 'var(--spacing-xs) 0' }}>
                                                        <code>{key}</code>
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-xs) 0', fontWeight: '600' }}>
                                                        {typeof value === 'number' && value < 1 && value > 0
                                                            ? `${(value * 100).toFixed(0)}%`
                                                            : value}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default RiskRules;
