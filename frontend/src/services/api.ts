import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add request interceptor if using auth
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Add response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const printerService = {
    getPrinters: () => api.get('/printers/'),
    getPrinter: (id: number) => api.get(`/printers/${id}`),
    addPrinter: (data: any) => api.post('/printers/', data),
    deletePrinter: (id: number) => api.delete(`/printers/${id}`)
};

export const discoveryService = {
    scan: (cidr: string, community: string = 'public') => 
        api.post('/discovery/scan', { cidr, snmp_community: community })
};

export default api;
