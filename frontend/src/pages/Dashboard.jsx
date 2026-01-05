import React, { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertTriangle, DollarSign, FileText, Activity } from 'lucide-react';
import DatasetControlPanel from '../components/DatasetControlPanel';
import './Dashboard.css';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = () => {
        setLoading(true);
        fetch('/api/analytics/summary')
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching stats:', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    // Construct Active Dataset object for the Control Panel
    const activeDataset = stats ? {
        dataset_name: stats.dataset_name,
        record_count: stats.total_records,
        uploaded_at: stats.uploaded_at
    } : null;

    const onDatasetUploaded = (newDataset) => {
        // Trigger a refresh of the analytics
        fetchAnalytics();
    };

    const summary = stats;
    const riskData = stats ? getRiskData(stats) : [];
    const charts = { agencySpend: stats?.agency_spend || [] };

    if (loading && !stats) return <div className="p-8">Loading Analytics...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header-simple mb-6">
                <h1>Procurement Analytics Overview</h1>
            </header>

            <DatasetControlPanel
                activeDataset={activeDataset?.dataset_name ? activeDataset : null}
                onUploadSuccess={onDatasetUploaded}
            />

            {(!stats || stats.total_records === 0) ? (
                <div className="empty-state">
                    <div className="empty-content">
                        <FileText size={48} className="text-gray-400 mb-4" />
                        <h2>No Data Available</h2>
                        <p>Upload a procurement dataset above to generate insights.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="dashboard-header">
                        <div>
                            <h1>Fraud Analytics Dashboard</h1>
                            <p>{summary?.dataset_name ? `Active Dataset: ${summary.dataset_name}` : 'No Active Dataset'}</p>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                            Last Updated: {summary?.uploaded_at ? new Date(summary.uploaded_at).toLocaleDateString() : '-'}
                        </div>
                    </div>

                    {/* Dataset Control */}
                    <DatasetControlPanel onUploadSuccess={fetchData} />

                    {/* Metrics */}
                    <div className="metrics-grid">
                        <MetricCard
                            title="Total Spend"
                            value={`$${(summary?.total_spend || 0).toLocaleString()}`}
                            icon={DollarSign}
                            trend="Based on active data"
                            color="blue"
                        />
                        <MetricCard
                            title="Total Contracts"
                            value={summary?.total_records || 0}
                            icon={FileText}
                            trend="Count"
                            color="indigo"
                        />
                        <MetricCard
                            title="High Risk Records"
                            value={summary?.high_risk_count || 0}
                            icon={AlertTriangle}
                            trend="Requires Audit"
                            color="red"
                        />
                        <MetricCard
                            title="Active Vendors"
                            value={summary?.active_vendors || 0}
                            icon={Users}
                            trend="Distinct Suppliers"
                            color="purple"
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="charts-grid">

                        {/* Agency Spend Bar Chart */}
                        <div className="chart-card">
                            <h3>Top Agencies by Spend</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={charts.agencySpend} layout="vertical" margin={{ left: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" tickFormatter={formatCurrency} />
                                        <YAxis dataKey="_id" type="category" width={120} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(val) => `$${val.toLocaleString()}`} />
                                        <Bar dataKey="total_spend" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Spend" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Risk Distribution Pie */}
                        <div className="chart-card">
                            <h3>Fraud Risk Distribution</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={riskData}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {riskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.name.includes('Low') ? COLORS[0] : entry.name.includes('Medium') ? COLORS[1] : COLORS[2]} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top Risky Procurements Table */}
                            <RiskyTable key={stats.uploaded_at} />
                            {/* key ensures table remounts/refetches on new upload */}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

const COLORS = { 'Low': '#00C853', 'Medium': '#FFAB00', 'High': '#D50000', 'Safe': '#2196F3' };

function getRiskData(stats) {
    const riskData = stats.department_risk_distribution?.map(d => ({
        name: d._id || 'Unknown',
        value: d.count
    })) || [];

    // Aggregate by risk level instead of department if the backend sends dept distribution?
    // Wait, the backend endpoint `department_risk_distribution` actually groups by Department where Risk=High.
    // The Pie Chart usually wants Risk Level breakdown (Low, Mid, High).
    // Let's check the backend again. 
    // Backend `riskCounts` groups by risk_level but it's flattened into `low_risk_count`, etc.
    // So we should build the Pie Data from those counts, not the department distribution.

    const data = [
        { name: 'Low', value: stats.low_risk_count },
        { name: 'Medium', value: stats.medium_risk_count },
        { name: 'High', value: stats.high_risk_count }
    ].filter(d => d.value > 0);

    if (data.length === 0) return [{ name: 'Safe', value: 1 }];
    return data;
}

function RiskyTable() {
    const [records, setRecords] = useState([]);

    useEffect(() => {
        fetch('/api/analytics/procurements')
            .then(res => res.json())
            .then(data => {
                const risky = data.filter(r => r.risk_score > 0).slice(0, 5);
                setRecords(risky);
            });
    }, []);

    if (records.length === 0) return null;

    return (
        <div className="risky-table-section">
            <h3>⚠️ Top Risky Procurements</h3>
            <div className="table-wrapper">
                <table className="risk-table">
                    <thead>
                        <tr>
                            <th>Tender No</th>
                            <th>Supplier</th>
                            <th>Amount</th>
                            <th>Risk Score</th>
                            <th>Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => (
                            <tr key={record._id}>
                                <td>{record.tender_no}</td>
                                <td>{record.supplier_name}</td>
                                <td>${record.awarded_amt?.toLocaleString() || '0'}</td>
                                <td>
                                    <span className={`risk-pill ${record.risk_level?.toLowerCase() || 'low'}`}>
                                        {record.risk_score} ({record.risk_level})
                                    </span>
                                </td>
                                <td>{record.risk_flags?.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
