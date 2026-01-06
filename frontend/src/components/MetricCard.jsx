import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import './MetricCard.css';

export default function MetricCard({ title, value, trend, icon: Icon, trendDown }) {
    return (
        <div className="metric-card">
            <div className="metric-header">
                <span className="metric-title">{title}</span>
                {Icon && <div className="metric-icon"><Icon size={20} /></div>}
            </div>

            <div className="metric-value">{value}</div>

            {trend && (
                <div className={`metric-trend ${trendDown ? 'down' : 'up'}`}>
                    {trendDown ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    {trend}
                </div>
            )}
        </div>
    );
}
