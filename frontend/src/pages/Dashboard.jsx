import React, { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { AlertTriangle, DollarSign, FileText, Activity, Users } from 'lucide-react';
import DatasetControlPanel from '../components/DatasetControlPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import './Dashboard.css';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAnalytics = () => {
        setLoading(true);
        setError(null);
        fetch('/api/analytics/summary')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch analytics');
                return res.json();
            })
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching stats:', err);
                setError(err.message);
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

    const summary = stats || {};
    const riskData = stats ? getRiskData(stats) : [];

    // Sanitize and limit chart data
    const agencySpendData = (stats?.department_spend || [])
        .map(d => ({ ...d, total_spend: d.total || d.total_spend }))
        .filter(d => d && d.total_spend > 0)
        .slice(0, 10);

    const charts = { agencySpend: agencySpendData };

    if (loading && !stats) return <div className="p-12 text-center text-gray-500">Loading Analytics...</div>;
    if (error && !stats) return <div className="p-12 text-center text-red-500">Error loading dashboard: {error}</div>;

    return (
        <ErrorBoundary>
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
                                <div style={{ width: '100%', height: 260 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={charts.agencySpend} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 0 }} barSize={24}>
                                            <defs>
                                                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                    <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis
                                                type="number"
                                                tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <YAxis
                                                dataKey="_id"
                                                type="category"
                                                width={140}
                                                tick={{ fontSize: 11, fill: '#4b5563' }}
                                                tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                                                interval={0}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f3f4f6' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(val) => [`$${val.toLocaleString()}`, 'Total Spend']}
                                            />
                                            <Bar
                                                dataKey="total_spend"
                                                fill="url(#barGradient)"
                                                radius={[0, 4, 4, 0]}
                                                background={{ fill: '#f9fafb', radius: [0, 4, 4, 0] }}
                                            />
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
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Top Risky Procurements Table */}
                                <ErrorBoundary>
                                    <RiskyTable key={stats.uploaded_at} />
                                </ErrorBoundary>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </ErrorBoundary>
    );
}

const COLORS = { 'Low': '#00C853', 'Medium': '#FFAB00', 'High': '#D50000', 'Safe': '#2196F3' };

function getRiskData(stats) {
    if (!stats) return [];

    const data = [
        { name: 'Low', value: stats.low_risk_count || 0 },
        { name: 'Medium', value: stats.medium_risk_count || 0 },
        { name: 'High', value: stats.high_risk_count || 0 }
    ].filter(d => d.value > 0);

    if (data.length === 0) return [{ name: 'Safe', value: 1 }];
    return data;
}

function RiskyTable() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetch('/api/analytics/procurements')
            .then(res => {
                if (!res.ok) throw new Error('API Error');
                return res.json();
            })
            .then(data => {
                if (mounted && Array.isArray(data)) {
                    // Filter and slice on frontend as a safety net, though backend should limit
                    const risky = data
                        .filter(r => r && r.risk_score > 0)
                        .slice(0, 5);
                    setRecords(risky);
                }
                if (mounted) setLoading(false);
            })
            .catch(err => {
                console.error("RiskyTable fetch error:", err);
                if (mounted) {
                    setError(true);
                    setLoading(false);
                }
            });

        return () => { mounted = false; };
    }, []);

    if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Loading risky records...</div>;
    if (error) return <div className="p-4 text-center text-red-400 text-sm">Unavailable</div>;
    if (!records || records.length === 0) return null;

    return (
        <div className="risky-table-section mt-6">
            <h3 className="mb-3 font-semibold text-gray-700">⚠️ Top Risky Procurements</h3>
            <div className="table-wrapper">
                <table className="risk-table w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                        <tr>
                            <th className="py-2 px-3">Tender No</th>
                            <th className="py-2 px-3">Supplier</th>
                            <th className="py-2 px-3">Amount</th>
                            <th className="py-2 px-3">Risk Score</th>
                            <th className="py-2 px-3">Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => (
                            <tr key={record._id || Math.random()} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 px-3 font-mono text-xs">{record.tender_no || 'N/A'}</td>
                                <td className="py-2 px-3">{record.supplier_name || 'Aggr. Supplier'}</td>
                                <td className="py-2 px-3">${(record.awarded_amt || 0).toLocaleString()}</td>
                                <td className="py-2 px-3">
                                    <span className={`risk-pill ${record.risk_level?.toLowerCase() || 'low'}`}>
                                        {record.risk_score || 0} ({record.risk_level || 'Low'})
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-xs text-gray-500 truncate max-w-[150px]" title={record.risk_flags?.join(', ')}>
                                    {record.risk_flags?.slice(0, 2).join(', ') || '-'}
                                    {record.risk_flags?.length > 2 && '...'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
