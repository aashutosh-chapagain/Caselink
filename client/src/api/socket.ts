import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';

const SOCKET_URL = import.meta.env.VITE_API_URL.replace('/api/v1', '');

let _socket: Socket | null = null;

export function getSocket(): Socket {
    if (!_socket) {
        const authStore = useAuthStore();
        _socket = io(SOCKET_URL, { auth: { token: authStore.token } });
    }
    return _socket;
}

export function destroySocket(): void {
    _socket?.disconnect();
    _socket = null;
}
