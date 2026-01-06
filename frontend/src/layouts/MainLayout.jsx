import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from '../components/TopBar';
import NavRail from '../components/NavRail';
import './MainLayout.css';

export default function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="app-shell">
            <TopBar toggleSidebar={toggleSidebar} />
            <div className="app-body">
                {/* Backdrop for mobile - only visible on small screens due to CSS */}
                <div
                    className={`nav-backdrop ${isSidebarOpen ? 'visible' : ''}`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                <NavRail isOpen={isSidebarOpen} />

                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
