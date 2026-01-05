/**
 * Suppliers Component
 * 
 * Lists all suppliers with their procurement statistics.
 * READ-ONLY view.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building, TrendingUp, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { dashboardAPI, riskAPI } from '../services/api';

function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierRisk, setSupplierRisk] = useState(null);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getSuppliers();
            setSuppliers(data.data?.suppliers || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSupplierClick = async (supplierId) => {
        if (selectedSupplier === supplierId) {
            setSelectedSupplier(null);
            setSupplierRisk(null);
            return;
        }

        setSelectedSupplier(supplierId);
        try {
            const data = await riskAPI.analyzeSupplier(supplierId);
            setSupplierRisk(data.data);
        } catch (err) {
            console.error('Failed to fetch supplier risk:', err);
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

    const formatPercent = (value) => {
        if (value === null || value === undefined) return '-';
        return (value * 100).toFixed(1) + '%';
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading suppliers...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center' }}>
                <AlertTriangle size={48} color="var(--color-danger-500)" />
                <h3 style={{ marginTop: '1rem' }}>Error Loading Suppliers</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2>Suppliers</h2>
                <p style={{ color: 'var(--color-gray-500)' }}>
                    {suppliers.length} suppliers with procurement activity
                </p>
            </div>

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Supplier</th>
                                <th style={{ textAlign: 'center' }}>Events</th>
                                <th style={{ textAlign: 'center' }}>Tenders</th>
                                <th style={{ textAlign: 'center' }}>Departments</th>
                                <th style={{ textAlign: 'center' }}>Win Rate</th>
                                <th style={{ textAlign: 'right' }}>Total Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((supplier) => (
                                <React.Fragment key={supplier.supplier_id}>
                                    <tr
                                        onClick={() => handleSupplierClick(supplier.supplier_id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                <Users size={16} color="var(--color-primary-500)" />
                                                <strong>{supplier.supplier_id}</strong>
                                                {selectedSupplier === supplier.supplier_id
                                                    ? <ChevronUp size={14} />
                                                    : <ChevronDown size={14} />
                                                }
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{supplier.event_count}</td>
                                        <td style={{ textAlign: 'center' }}>{supplier.tender_count}</td>
                                        <td style={{ textAlign: 'center' }}>{supplier.department_count}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{
                                                background: supplier.baseline?.win_rate > 0.6
                                                    ? 'var(--color-warning-50)'
                                                    : 'var(--color-gray-100)',
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontWeight: supplier.baseline?.win_rate > 0.6 ? '600' : '400'
                                            }}>
                                                {formatPercent(supplier.baseline?.win_rate)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                                            {supplier.baseline?.contract_total
                                                ? formatCurrency(supplier.baseline.contract_total)
                                                : '-'}
                                        </td>
                                    </tr>

                                    {selectedSupplier === supplier.supplier_id && supplierRisk && (
                                        <tr>
                                            <td colSpan="6" style={{ background: 'var(--color-gray-50)', padding: 'var(--spacing-lg)' }}>
                                                <div>
                                                    <h4 style={{ marginBottom: 'var(--spacing-md)' }}>
                                                        Risk Analysis (Last 12 Months)
                                                    </h4>

                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                                        gap: 'var(--spacing-md)',
                                                        marginBottom: 'var(--spacing-md)'
                                                    }}>
                                                        <div>
                                                            <strong>Events Analyzed:</strong> {supplierRisk.events_analyzed}
                                                        </div>
                                                        <div>
                                                            <strong>Total Flags:</strong> {supplierRisk.total_flags}
                                                        </div>
                                                        <div>
                                                            <strong>Risk Points:</strong> {supplierRisk.total_risk_points}
                                                        </div>
                                                        <div>
                                                            <strong>Departments:</strong> {supplierRisk.departments?.join(', ') || 'None'}
                                                        </div>
                                                    </div>

                                                    {supplierRisk.flags_by_type?.length > 0 && (
                                                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                                                            <strong>Flags by Type:</strong>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                                                {supplierRisk.flags_by_type.map((ft) => (
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
                                                        {supplierRisk.disclaimer}
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

export default Suppliers;
