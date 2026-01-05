import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import TextField from '../components/TextField';
import { Search } from 'lucide-react';
import './Records.css';

// Mock Data
const MOCK_DATA = [
    { id: 'TND-2025-001', department: 'Infrastructure', vendor: 'BuildCorp Ltd.', amount: '$1,250,000', date: '2025-01-15', status: 'Completed' },
    { id: 'TND-2025-002', department: 'Health', vendor: 'MediCare Supplies', amount: '$45,000', date: '2025-01-18', status: 'Active' },
    { id: 'TND-2025-003', department: 'Education', vendor: 'EdTech Solutions', amount: '$320,000', date: '2025-01-20', status: 'Pending' },
    { id: 'TND-2025-004', department: 'Transport', vendor: 'City Transit Inc.', amount: '$850,000', date: '2025-01-22', status: 'Active' },
    { id: 'TND-2025-005', department: 'IT Services', vendor: 'CloudNine Systems', amount: '$120,000', date: '2025-01-25', status: 'Completed' },
    { id: 'TND-2025-006', department: 'Parks', vendor: 'GreenGrow', amount: '$15,000', date: '2025-01-28', status: 'Active' },
    { id: 'TND-2025-007', department: 'Sanitation', vendor: 'CleanCity Co.', amount: '$210,000', date: '2025-02-01', status: 'Pending' },
];

export default function Records() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);

    // Fetch Records
    React.useEffect(() => {
        fetch('/api/procurement-records')
            .then(res => res.json())
            .then(records => {
                setData(records);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch records:', err);
                setLoading(false);
            });
    }, []);

    // Filter logic
    const filteredData = data.filter(row =>
        row.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.tender_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        { key: 'tender_id', label: 'Tender ID' },
        { key: 'department', label: 'Department' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'amount', label: 'Amount', align: 'right' },
        {
            key: 'event_date',
            label: 'Date',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => {
                return <span className="badge badge-green">Synced</span>;
            }
        }
    ];

    return (
        <div className="records-container">
            <div className="records-header">
                <div>
                    <h2>Procurement Records</h2>
                    <p>Manage and monitor all tender activities.</p>
                </div>
                <div className="records-search">
                    <TextField
                        label="Search Records..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        id="search"
                    />
                </div>
            </div>

            <DataTable
                columns={columns}
                data={filteredData}
                onRowClick={(row) => navigate(`/records/${row._id}`)}
            />

            <div className="pagination">
                <span>Showing {filteredData.length} records</span>
                <div className="pagination-controls">
                    <button className="page-btn" disabled>Previous</button>
                    <button className="page-btn active">1</button>
                    <button className="page-btn">Next</button>
                </div>
            </div>
        </div>
    );
}
