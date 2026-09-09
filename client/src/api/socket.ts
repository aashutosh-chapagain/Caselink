import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';

const SOCKET_URL = import.meta.env.VITE_API_URL.replace('/api/v1', '');

export function createSocket(): Socket {
    const authStore = useAuthStore();
    return io(SOCKET_URL, {
        auth: { token: authStore.token },
    });
}
