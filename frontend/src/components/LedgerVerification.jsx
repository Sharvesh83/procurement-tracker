/**
 * Ledger Verification Component
 * 
 * Allows users to verify the integrity of the tamper-evident ledger.
 * Displays verification results and ledger statistics.
 * 
 * READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, Clock, Hash, FileText, RefreshCw } from 'lucide-react';
import { ledgerAPI, eventsAPI } from '../services/api';

function LedgerVerification() {
    const [verification, setVerification] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await eventsAPI.getStats();
            setStats(data.data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const runVerification = async () => {
        try {
            setVerifying(true);
            const data = await ledgerAPI.verify();
            setVerification(data.data);
        } catch (err) {
            setVerification({
                is_valid: false,
                error_type: 'VERIFICATION_ERROR',
                error_message: err.message
            });
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2>Ledger Verification</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    Verify the integrity of the tamper-evident procurement ledger
                </p>
            </div>

            {/* How It Works */}
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <Shield size={20} />
                        How Tamper-Evidence Works
                    </h3>
                </div>
                <div className="card-body">
                    <p style={{ marginBottom: 'var(--spacing-md)' }}>
                        Every procurement event is secured using SHA-256 cryptographic hashing:
                    </p>
                    <ol style={{ paddingLeft: 'var(--spacing-lg)', lineHeight: '2' }}>
                        <li>Each event's data is converted to a canonical JSON format</li>
                        <li>The event is combined with the previous event's hash</li>
                        <li>A SHA-256 hash is computed: <code>hash = SHA256(event_data + previous_hash)</code></li>
                        <li>This creates an unbroken chain where modifying any event invalidates all subsequent hashes</li>
                    </ol>
                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-gray-600)' }}>
                        <strong>Verification</strong> recomputes all hashes and checks the chain integrity.
                        Any tampering will be detected and reported.
                    </p>
                </div>
            </div>

            {/* Ledger Stats */}
            {stats && (
                <div className="stats-grid" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <FileText size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Total Events</h3>
                            <div className="stat-value">{stats.total_events?.toLocaleString() || 0}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <Hash size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Last Sequence</h3>
                            <div className="stat-value">{stats.last_sequence_number || 0}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <Clock size={24} />
                        </div>
                        <div className="stat-content">
                            <h3>Last Event</h3>
                            <div className="stat-value" style={{ fontSize: '0.875rem' }}>
                                {stats.last_event_date
                                    ? new Date(stats.last_event_date).toLocaleDateString()
                                    : 'No events'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Verification Button */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Shield size={20} />
                        Run Integrity Verification
                    </h3>
                </div>
                <div className="card-body" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <button
                        className="btn btn-primary"
                        onClick={runVerification}
                        disabled={verifying}
                        style={{
                            padding: 'var(--spacing-md) var(--spacing-xl)',
                            fontSize: '1rem'
                        }}
                    >
                        {verifying ? (
                            <>
                                <RefreshCw size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                                Verifying...
                            </>
                        ) : (
                            <>
                                <Shield size={20} />
                                Verify Ledger Integrity
                            </>
                        )}
                    </button>

                    <p style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
                        This will recompute all hashes and verify the complete chain
                    </p>
                </div>

                {/* Verification Results */}
                {verification && (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        borderTop: '1px solid var(--color-gray-100)',
                        background: verification.is_valid ? 'var(--color-success-50)' : 'var(--color-danger-50)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                            {verification.is_valid ? (
                                <>
                                    <CheckCircle size={32} color="var(--color-success-500)" />
                                    <div>
                                        <h3 style={{ color: 'var(--color-success-600)' }}>Ledger Verified</h3>
                                        <p style={{ color: 'var(--color-success-600)', margin: 0 }}>
                                            No tampering detected. All {verification.verified_events} events validated.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle size={32} color="var(--color-danger-500)" />
                                    <div>
                                        <h3 style={{ color: 'var(--color-danger-600)' }}>Integrity Compromised!</h3>
                                        <p style={{ color: 'var(--color-danger-600)', margin: 0 }}>
                                            Tampering detected. The ledger has been modified.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <div style={{
                            background: verification.is_valid ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.5)',
                            padding: 'var(--spacing-md)',
                            borderRadius: 'var(--radius-md)',
                            marginTop: 'var(--spacing-md)'
                        }}>
                            <table style={{ width: '100%', fontSize: '0.875rem' }}>
                                <tbody>
                                    <tr>
                                        <td><strong>Total Events:</strong></td>
                                        <td>{verification.total_events}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Verified Events:</strong></td>
                                        <td>{verification.verified_events}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Verification Time:</strong></td>
                                        <td>{verification.verification_time_ms}ms</td>
                                    </tr>
                                    {verification.error_type && (
                                        <>
                                            <tr>
                                                <td><strong>Error Type:</strong></td>
                                                <td style={{ color: 'var(--color-danger-600)' }}>{verification.error_type}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Error Message:</strong></td>
                                                <td style={{ color: 'var(--color-danger-600)' }}>{verification.error_message}</td>
                                            </tr>
                                            {verification.first_invalid_sequence && (
                                                <tr>
                                                    <td><strong>First Invalid Sequence:</strong></td>
                                                    <td>{verification.first_invalid_sequence}</td>
                                                </tr>
                                            )}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Last Hash Display */}
            {stats?.last_event_hash && (
                <div className="card" style={{ marginTop: 'var(--spacing-xl)' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            <Hash size={20} />
                            Latest Event Hash
                        </h3>
                    </div>
                    <div className="card-body">
                        <code style={{
                            display: 'block',
                            padding: 'var(--spacing-md)',
                            background: 'var(--color-gray-100)',
                            borderRadius: 'var(--radius-md)',
                            wordBreak: 'break-all',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {stats.last_event_hash}
                        </code>
                        <p style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                            This hash cryptographically links to all previous events in the ledger.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LedgerVerification;
