import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, UploadCloud } from 'lucide-react';
import './NavRail.css';

export default function NavRail({ isOpen }) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user?.role || 'public'; // Default to public if not logged in

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: FileText, label: 'Records', path: '/records' },
        // Only allow Upload for 'auditor' or 'analyst' (or 'admin')
        {
            icon: UploadCloud,
            label: 'Upload Dataset',
            path: '/upload'
        },

    ].filter(item => !item.hidden);

    return (
        <aside className={`nav-rail ${isOpen ? 'open' : 'closed'}`} aria-label="Main Navigation">
            <div className="nav-content">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `nav-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`
                        }
                        onClick={(e) => item.disabled && e.preventDefault()}
                    >
                        <div className="nav-icon-container">
                            <item.icon size={24} />
                        </div>
                        <span className="nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </aside>
    );
}
