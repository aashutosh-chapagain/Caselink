import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL
});

apiClient.interceptors.request.use((config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const authStore = useAuthStore();
            authStore.logout();
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default apiClient;