import React, { useState } from 'react';
import { User, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './TopBar.css';

export default function TopBar({ toggleSidebar }) {
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const userName = user?.name || 'Guest User';

    return (
        <header className="top-bar">
            <div className="top-bar-left">
                <button className="icon-btn" onClick={toggleSidebar} aria-label="Toggle Menu">
                    <Menu size={24} />
                </button>
                <h1 className="app-title">ProcureWatch</h1>
            </div>
            <div className="top-bar-right">
                <div
                    className="user-profile"
                    onClick={() => setShowMenu(!showMenu)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                >
                    <span className="user-name">{userName}</span>
                    <div className="avatar">
                        <User size={20} />
                    </div>

                    {showMenu && (
                        <div className="user-dropdown">
                            <button className="dropdown-item text-red-600" onClick={logout}>
                                <LogOut size={16} className="mr-2" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
