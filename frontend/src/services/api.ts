import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// ─── Token helpers ────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('token') || localStorage.getItem('access_token');
const setToken = (t: string) => {
    localStorage.setItem('token', t);
    localStorage.setItem('access_token', t);
};

/** Decode JWT payload without verifying signature (client-side only) */
const getTokenExpiry = (token: string): number | null => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp ? payload.exp * 1000 : null; // ms
    } catch {
        return null;
    }
};

// ─── Silent token refresh ─────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleRefresh = (token: string) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    // Refresh 5 minutes before expiry
    const delay = expiry - Date.now() - 5 * 60 * 1000;
    if (delay <= 0) return; // already expired or too close

    refreshTimer = setTimeout(async () => {
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`,
                {},
                { headers: { Authorization: `Bearer ${getToken()}` } }
            );
            const newToken = res.data.access_token;
            setToken(newToken);
            scheduleRefresh(newToken); // schedule next refresh
        } catch {
            // If refresh fails (token truly expired), redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }, delay);
};

// Start refresh schedule on load if a token already exists
const existingToken = getToken();
if (existingToken) {
    scheduleRefresh(existingToken);
}

// ─── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
let isRedirecting = false;

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !isRedirecting) {
            isRedirecting = true;
            localStorage.removeItem('token');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ─── Services ─────────────────────────────────────────────────────────────────
export const printerService = {
    getPrinters: () => api.get('/printers/'),
    getPrinter: (id: number) => api.get(`/printers/${id}`),
    addPrinter: (data: any) => api.post('/printers/', data),
    deletePrinter: (id: number) => api.delete(`/printers/${id}`),
    getDashboardSummary: () => api.get('/printers/dashboard/summary'),
    borrowPrinter: (id: number, data: { department: string; remark?: string }) => api.post(`/printers/${id}/borrow`, data)
};

export const discoveryService = {
    scan: (cidr: string, community: string = 'public') =>
        api.post('/discovery/scan', { cidr, snmp_community: community })
};

export const alertService = {
    getAlerts: (isResolved?: boolean) => {
        let url = '/alerts/';
        if (isResolved !== undefined) {
            url += `?is_resolved=${isResolved}`;
        }
        return api.get(url);
    },
    resolveAlert: (id: number) => api.put(`/alerts/${id}/resolve`, {})
};

export { scheduleRefresh };
export default api;
