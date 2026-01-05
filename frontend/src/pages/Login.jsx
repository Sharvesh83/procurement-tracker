import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react'; // Using Lucide icon for logo
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Update Context
                login(data); // data contains { _id, email, role, token }
                // Redirect happens automatically due to PublicOnlyRoute, but we can explicit nav
                navigate('/');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('System error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo-area">
                        <div className="app-logo">
                            <ShieldCheck size={28} />
                        </div>
                    </div>
                    <h1 className="login-title">ProcureWatch</h1>
                    <p className="login-subtitle">Public Procurement Monitoring System</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="login-form">
                    <TextField
                        id="email"
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@procurewatch.gov"
                    />
                    <TextField
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                    />

                    <Button type="submit" variant="filled" className="login-btn" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Login'}
                    </Button>

                    <div className="login-links">
                        <span>New to the system?</span>
                        <Link to="/signup" className="link-text">Create an account</Link>
                    </div>
                </form>

                <div className="login-footer">
                    <div className="govt-seal">
                        <div className="seal-circle"></div>
                    </div>
                    <span className="footer-text">Official Government Portal</span>
                </div>
            </div>
        </div>
    );
}
