/**
 * API Service
 * 
 * Centralized API communication layer.
 * All API calls go through this service for consistent error handling
 * and authentication token management.
 */

const API_BASE = '/api';

/**
 * Get stored auth token
 */
const getToken = () => localStorage.getItem('token');

/**
 * Make an authenticated API request
 */
const request = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        // Handle non-JSON responses gracefully
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            // Server returned non-JSON (likely HTML error page or empty response)
            if (!response.ok) {
                throw new Error('Server error. Please try again later.');
            }
            data = { success: false, message: 'Invalid server response' };
        }

        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }

        return data;
    } catch (error) {
        // Network errors or other fetch failures
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Unable to connect to server. Please check your connection.');
        }
        throw error;
    }
};

/**
 * Auth API
 */
export const authAPI = {
    login: async (username, password) => {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.data?.token) {
            localStorage.setItem('token', data.data.token);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return data;
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    isAuthenticated: () => !!getToken(),

    getProfile: () => request('/auth/me')
};

/**
 * Events API
 */
export const eventsAPI = {
    list: (page = 1, limit = 50) =>
        request(`/events?page=${page}&limit=${limit}`),

    getTenderEvents: (tenderId) =>
        request(`/events/tender/${tenderId}`),

    getDepartmentEvents: (departmentId, startDate, endDate) => {
        let url = `/events/department/${departmentId}`;
        if (startDate || endDate) {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            url += `?${params.toString()}`;
        }
        return request(url);
    },

    getRecent: (count = 10) =>
        request(`/events/recent?count=${count}`),

    getStats: () =>
        request('/events/stats'),

    submit: (eventData) =>
        request('/events', {
            method: 'POST',
            body: JSON.stringify(eventData)
        })
};

/**
 * Ledger API
 */
export const ledgerAPI = {
    verify: () =>
        request('/verify-ledger'),

    getStatus: () =>
        request('/verify-ledger/status'),

    verifyEvent: (eventId) =>
        request(`/verify-ledger/event/${eventId}`)
};

/**
 * Risk API
 */
export const riskAPI = {
    analyzeTender: (tenderId) =>
        request(`/risk/tender/${tenderId}`),

    analyzeDepartment: (departmentId) =>
        request(`/risk/department/${departmentId}`),

    analyzeSupplier: (supplierId) =>
        request(`/risk/supplier/${supplierId}`),

    getRules: () =>
        request('/risk/rules'),

    recomputeBaselines: () =>
        request('/risk/recompute-baselines', { method: 'POST' }),

    getBaseline: (type, entityId) =>
        request(`/risk/baselines/${type}/${entityId}`)
};

/**
 * Dashboard API
 */
export const dashboardAPI = {
    getOverview: () =>
        request('/dashboard/overview'),

    getPublic: async () => {
        // Public endpoint, no auth needed
        try {
            const response = await fetch(`${API_BASE}/dashboard/public`);
            if (!response.ok) {
                // Return fallback data structure when server is unavailable
                return {
                    success: false,
                    data: {
                        summary: { total_tenders: 0, total_departments: 0, events_by_type: {} },
                        financials: null,
                        disclaimer: 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.',
                        generated_at: null
                    }
                };
            }
            return response.json();
        } catch (error) {
            // Network error - return fallback
            return {
                success: false,
                data: {
                    summary: { total_tenders: 0, total_departments: 0, events_by_type: {} },
                    financials: null,
                    disclaimer: 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.',
                    generated_at: null
                }
            };
        }
    },

    getDepartments: () =>
        request('/dashboard/departments'),

    getSuppliers: () =>
        request('/dashboard/suppliers'),

    getHighRiskTenders: (limit = 20) =>
        request(`/dashboard/high-risk-tenders?limit=${limit}`)
};
