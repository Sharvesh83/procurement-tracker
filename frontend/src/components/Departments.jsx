/**
 * Departments Component
 * 
 * Lists all departments with their procurement statistics.
 * READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building, TrendingUp, Users, FileText, AlertTriangle } from 'lucide-react';
import { dashboardAPI, riskAPI } from '../services/api';

function Departments() {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDept, setSelectedDept] = useState(null);
    const [deptRisk, setDeptRisk] = useState(null);

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getDepartments();
            setDepartments(data.data?.departments || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeptClick = async (deptId) => {
        if (selectedDept === deptId) {
            setSelectedDept(null);
            setDeptRisk(null);
            return;
        }

        setSelectedDept(deptId);
        try {
            const data = await riskAPI.analyzeDepartment(deptId);
            setDeptRisk(data.data);
        } catch (err) {
            console.error('Failed to fetch department risk:', err);
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
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading departments...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--color-danger-500)" />
                <h3 style={{ marginTop: '1rem' }}>Error Loading Departments</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2>Departments</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    {departments.length} departments with procurement activity
                </p>
            </div>

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th style={{ textAlign: 'center' }}>Events</th>
                                <th style={{ textAlign: 'center' }}>Tenders</th>
                                <th style={{ textAlign: 'center' }}>Suppliers</th>
                                <th style={{ textAlign: 'right' }}>Avg Contract</th>
                                <th style={{ textAlign: 'right' }}>Total Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept) => (
                                <React.Fragment key={dept.department_id}>
                                    <tr
                                        onClick={() => handleDeptClick(dept.department_id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                <Building size={16} color="var(--color-primary-500)" />
                                                <strong>{dept.department_id}</strong>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{dept.event_count}</td>
                                        <td style={{ textAlign: 'center' }}>{dept.tender_count}</td>
                                        <td style={{ textAlign: 'center' }}>{dept.supplier_count}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {dept.baseline?.contract_avg
                                                ? formatCurrency(dept.baseline.contract_avg)
                                                : '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                            {dept.baseline?.contract_total
                                                ? formatCurrency(dept.baseline.contract_total)
                                                : '-'}
                                        </td>
                                    </tr>

                                    {selectedDept === dept.department_id && deptRisk && (
                                        <tr>
                                            <td colSpan="6" style={{ background: 'var(--color-gray-50)', padding: 'var(--spacing-lg)' }}>
                                                <div>
                                                    <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
                                                        Risk Analysis (Last 12 Months)
                                                    </h4>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                        gap: 'var(--spacing-md)'
                                                    }}>
                                                        <div>
                                                            <strong>Events Analyzed:</strong> {deptRisk.events_analyzed}
                                                        </div>
                                                        <div>
                                                            <strong>Total Flags:</strong> {deptRisk.total_flags}
                                                        </div>
                                                        <div>
                                                            <strong>Risk Points:</strong> {deptRisk.total_risk_points}
                                                        </div>
                                                    </div>

                                                    {deptRisk.flags_by_type?.length > 0 && (
                                                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                                                            <strong>Flags by Type:</strong>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                                                {deptRisk.flags_by_type.map((ft) => (
                                                                    <span
                                                                        key={ft.risk_type}
                                                                        style={{
                                                                            background: 'var(--color-warning-50)',
                                                                            padding: '4px 8px',
                                                                            borderRadius: 'var(--radius-sm)',
                                                                            fontSize: '0.75rem'
                                                                        }}
                                                                    >
                                                                        {ft.risk_type}: {ft.count}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <p style={{
                                                        marginTop: 'var(--spacing-md)',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-gray-500)',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        {deptRisk.disclaimer}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Departments;
