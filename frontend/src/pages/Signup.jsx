import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import './Login.css'; // Reusing Login styles

export default function Signup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'auditor' // Default
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleRoleChange = (role) => {
        setFormData({ ...formData, role });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                // Auto-login
                login(data);
                navigate('/');
            } else {
                setError(data.message || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            setError('System error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo-area">
                        <div className="app-logo" style={{ background: '#10b981' }}>
                            <UserPlus size={28} />
                        </div>
                    </div>
                    <h1 className="login-title">Create Account</h1>
                    <p className="login-subtitle">Join ProcureWatch System</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="login-form">
                    <TextField
                        id="name"
                        label="Full Name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="John Doe"
                    />
                    <TextField
                        id="email"
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="name@agency.gov"
                    />
                    <TextField
                        id="password"
                        label="Password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a strong password"
                    />

                    <div className="role-selection">
                        <label>Select Role:</label>
                        <div className="role-chips">
                            <button
                                type="button"
                                className={`role-chip ${formData.role === 'auditor' ? 'active' : ''}`}
                                onClick={() => handleRoleChange('auditor')}
                            >
                                Auditor
                            </button>
                            <button
                                type="button"
                                className={`role-chip ${formData.role === 'analyst' ? 'active' : ''}`}
                                onClick={() => handleRoleChange('analyst')}
                            >
                                Analyst
                            </button>
                            <button
                                type="button"
                                className={`role-chip ${formData.role === 'public' ? 'active' : ''}`}
                                onClick={() => handleRoleChange('public')}
                            >
                                Public
                            </button>
                        </div>
                    </div>

                    <Button type="submit" variant="filled" className="login-btn" disabled={loading} style={{ background: '#10b981' }}>
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </Button>

                    <div className="login-links">
                        <span>Already have an account? </span>
                        <Link to="/login" className="link-text" style={{ color: '#10b981' }}>Login here</Link>
                    </div>
                </form>

                <div className="login-footer">
                    <span className="footer-text">Secure Government System</span>
                </div>
            </div>
        </div>
    );
}
