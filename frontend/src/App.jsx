/**
 * Main Application Component
 * 
 * Root component with routing and authentication context.
 * 
 * IMPORTANT: This is a READ-ONLY monitoring dashboard.
 * There are NO edit or delete buttons by design.
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Building2, Users, FileText, CheckCircle, AlertOctagon, LogOut, Upload as UploadIcon } from 'lucide-react';
import { authAPI } from './services/api';

// Components
import Dashboard from './components/Dashboard';
import TenderDetail from './components/TenderDetail';
import Departments from './components/Departments';
import Suppliers from './components/Suppliers';
import LedgerVerification from './components/LedgerVerification';
import RiskRules from './components/RiskRules';
import PublicView from './components/PublicView';
import Upload from './components/Upload';
import Login from './components/Login';
import FileUpload from './components/FileUpload';

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = authAPI.getUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        const result = await authAPI.login(username, password);

        // Support both shapes:
        // 1) axios-style: result.data = { success, data: { user, token } }
        // 2) older/alternate: result.data = { user }
        const userFromResponse =
            result?.data?.data?.user ??
            result?.data?.user ??
            result?.data?.data ??
            null;

        if (!userFromResponse) {
            throw new Error('Login succeeded but user payload was missing.');
        }

        setUser(userFromResponse);
        return result;
    };

    const logout = () => {
        authAPI.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

// Protected Route
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

// Header Component
function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="header">
            <div className="header-content">
                <Link to="/" className="header-logo">
                    <Shield size={28} />
                    <h1>Procurement Monitor</h1>
                </Link>

                {user && (
                    <>
                        <nav className="header-nav">
                            <Link to="/">Dashboard</Link>

                            {user.role === 'AUDITOR' && (
                                <Link to="/upload" className="flex items-center">
                                    <UploadIcon size={16} className="mr-1" />
                                    Upload
                                </Link>
                            )}

                            <Link to="/departments">Departments</Link>
                            <Link to="/suppliers">Suppliers</Link>
                            <Link to="/verify">Verify Ledger</Link>
                            <Link to="/rules">Risk Rules</Link>
                        </nav>

                        <div className="header-user">
                            <span>{user.fullName || user.username}</span>
                            <span style={{
                                background: user.role === 'PROCUREMENT_OFFICER' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.7rem'
                            }}>
                                {user.role === 'PROCUREMENT_OFFICER' ? 'Officer' : 'Auditor'}
                            </span>
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                                title="Logout"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}

// Main App Layout
function AppLayout({ children }) {
    return (
        <div className="app-container">
            <Header />

            {/* Disclaimer Banner */}
            <div className="disclaimer-banner" style={{ margin: '0', borderRadius: '0' }}>
                <p>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    <strong>IMPORTANT:</strong> This system does NOT determine corruption.
                    It highlights abnormal procurement patterns for human review only.
                </p>
            </div>

            <main className="main-content">
                {children}
            </main>

            <footer style={{
                background: 'var(--color-gray-800)',
                color: 'var(--color-gray-400)',
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
                fontSize: '0.875rem'
            }}>
                <p>Procurement Monitoring System • Read-Only Dashboard • All data is tamper-evident</p>
            </footer>
        </div>
    );
}

// Main App Component
function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/login"
                        element={
                            <LoginRedirectGuard>
                                <Login />
                            </LoginRedirectGuard>
                        }
                    />
                    <Route path="/public" element={<PublicView />} />

                    {/* Protected Routes */}
                    <Route path="/" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <Dashboard />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/tender/:tenderId" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <TenderDetail />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/departments" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <Departments />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/suppliers" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <Suppliers />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/verify" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <LedgerVerification />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/rules" element={
                        <ProtectedRoute>
                            <AppLayout>
                                <RiskRules />
                            </AppLayout>
                        </ProtectedRoute>
                    } />

                    <Route path="/upload" element={
                        <ProtectedRoute>
                            <RoleGuard allowedRoles={['AUDITOR']}>
                                <AppLayout>
                                    <Upload />
                                </AppLayout>
                            </RoleGuard>
                        </ProtectedRoute>
                    } />



                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

// Role Guard Component
function RoleGuard({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) return null;

    if (!user || !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

// Redirect authenticated users away from /login
function LoginRedirectGuard({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return children;
}

export default App;
