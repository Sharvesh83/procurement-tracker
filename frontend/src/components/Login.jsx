/**
 * Login Component
 * 
 * Simple authentication form for Procurement Officers and Auditors.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, User, Lock, AlertCircle, Eye, Activity } from 'lucide-react';
import { useAuth } from '../App';
import { systemAPI, authAPI } from '../services/api';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [systemStatus, setSystemStatus] = useState({ online: false, message: '' });
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await systemAPI.checkHealth();
                if (response) {
                    setSystemStatus({
                        online: true,
                        mode: response.mode || 'ONLINE',
                        dbStatus: response.db_status,
                        message: `System Online (${response.mode || 'Server'} Mode${response.db_status ? ` - DB: ${response.db_status}` : ''})`
                    });
                }
            } catch (err) {
                setSystemStatus({
                    online: false,
                    message: 'Backend Unreachable'
                });
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Shield size={48} color="var(--color-primary-600)" />
                    <h1 style={{ marginTop: '1rem' }}>Procurement Monitor</h1>

                    {systemStatus.message && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginTop: '0.5rem',
                            padding: '4px 12px',
                            background: systemStatus.online ? 'var(--color-success-50)' : 'var(--color-danger-50)',
                            color: systemStatus.online ? 'var(--color-success-700)' : 'var(--color-danger-700)',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: systemStatus.online ? 'var(--color-success-500)' : 'var(--color-danger-500)',
                                marginRight: '8px'
                            }}></div>
                            {systemStatus.message}
                        </div>
                    )}

                    <p style={{ color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>
                        Transparency Dashboard Login
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'var(--color-danger-50)',
                        border: '1px solid var(--color-danger-500)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)'
                    }}>
                        <AlertCircle size={20} color="var(--color-danger-500)" />
                        <span style={{ color: 'var(--color-danger-600)' }}>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">
                            <User size={16} style={{ marginRight: '8px', display: 'inline' }} />
                            Username
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            <Lock size={16} style={{ marginRight: '8px', display: 'inline' }} />
                            Password
                        </label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div style={{
                    marginTop: 'var(--spacing-xl)',
                    textAlign: 'center',
                    borderTop: '1px solid var(--color-gray-200)',
                    paddingTop: 'var(--spacing-lg)'
                }}>
                    <Link
                        to="/public"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-sm)',
                            color: 'var(--color-gray-600)'
                        }}
                    >
                        <Eye size={16} />
                        View Public Transparency Dashboard
                    </Link>
                </div>

                <div style={{
                    marginTop: 'var(--spacing-lg)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--color-gray-500)'
                }}>
                    <p style={{ marginBottom: '0.5rem', fontWeight: '600' }}>Demo Credentials:</p>
                    <p>Officer: officer1 / Officer123!</p>
                    <p>Auditor: auditor1 / Auditor123!</p>
                </div>
            </div>
        </div>
    );
}

export default Login;
