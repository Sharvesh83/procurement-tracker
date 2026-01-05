import React from 'react';
import './DataTable.css';
import { ChevronRight } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick }) {
    return (
        <div className="table-container">
            <table className="md-table">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} className={col.align === 'right' ? 'align-right' : ''}>
                                {col.label}
                            </th>
                        ))}
                        <th className="action-col"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, index) => (
                            <tr key={row.id || index} onClick={() => onRowClick && onRowClick(row)}>
                                {columns.map((col) => (
                                    <td key={col.key} className={col.align === 'right' ? 'align-right' : ''}>
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                                <td className="action-col">
                                    <ChevronRight size={20} className="row-arrow" />
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length + 1} className="empty-state">
                                No records found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
