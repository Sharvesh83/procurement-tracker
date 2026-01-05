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
                    {/* Header Info is now in Control Panel, but we keep Risk Badge here or move it? 
                        Let's keep the risk summary visible below the panel. 
                    */}
                    <div className="risk-banner mb-6">
                        {stats.high_risk_count > 0 ? (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
                                <AlertTriangle size={20} />
                                <span className="font-semibold">Attention Needed:</span>
                                {stats.high_risk_count} High Risk contracts detected in this dataset.
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
                                <Activity size={20} />
                                <span className="font-semibold">System Healthy:</span>
                                No high risk contracts found.
                            </div>
                        )}
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="metrics-grid">
                        <MetricCard
                            title="Total Spend"
                            value={`$${(stats.total_spend / 1000000).toFixed(1)}M`}
                            trend="vs last upload"
                            icon={DollarSign}
                        />
                        <MetricCard
                            title="Total Records"
                            value={stats.total_records}
                            trend="Rows Processed"
                            icon={FileText}
                        />
                        <MetricCard
                            title="High Risk Contracts"
                            value={stats.high_risk_count}
                            trend={stats.high_risk_count > 0 ? "Critical Issues Found" : "System Healthy"}
                            icon={AlertTriangle}
                            trendDown={false}
                        />
                        <MetricCard
                            title="Active Vendors"
                            value={stats.active_vendors || 0}
                            icon={Activity}
                        />
                    </div>

                    {/* Charts Section */}
                    <div className="charts-grid">
                        {/* Risk Distribution Pie */}
                        <div className="chart-card">
                            <h3>Risk Distribution</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={getRiskData(stats)}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {getRiskData(stats).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || ['#8884d8', '#82ca9d'][index % 2]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="chart-legend">
                                    {getRiskData(stats).map(d => (
                                        <div key={d.name} className="legend-item">
                                            <span className="dot" style={{ background: COLORS[d.name] }}></span>
                                            {d.name}: {d.value}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Department Spend Bar */}
                        <div className="chart-card">
                            <h3>Top Dept Spend</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={stats.department_spend.map(d => ({ name: d._id, amount: d.total }))}>
                                        <XAxis dataKey="name" fontSize={12} tick={{ fill: '#666' }} />
                                        <YAxis fontSize={12} tick={{ fill: '#666' }} />
                                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                                        <Bar dataKey="amount" fill="#00796B" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Top Risky Procurements Table */}
                    <RiskyTable key={stats.uploaded_at} />
                    {/* key ensures table remounts/refetches on new upload */}
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
                            <th>Tender ID</th>
                            <th>Vendor</th>
                            <th>Amount</th>
                            <th>Risk Score</th>
                            <th>Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(record => (
                            <tr key={record._id}>
                                <td>{record.tender_id}</td>
                                <td>{record.vendor}</td>
                                <td>${record.amount.toLocaleString()}</td>
                                <td>
                                    <span className={`risk-pill ${record.risk_level.toLowerCase()}`}>
                                        {record.risk_score} ({record.risk_level})
                                    </span>
                                </td>
                                <td>{record.risk_flags.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
