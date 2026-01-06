import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        // Redirect to login page, but save the current location they were trying to go to
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Unauthorized role
        // For now, just redirect to dashboard or show unauthorized page
        // If they are on dashboard and unauthorized, maybe login? But assumed dashboard is safe for all "authenticated"
        return <Navigate to="/" replace />;
    }

    return children;
}
