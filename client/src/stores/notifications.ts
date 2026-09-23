import { defineStore } from 'pinia';
import { getNotifications, markAllRead, type Notification } from '../api/notifications';
import { getSocket } from '../api/socket';

let _registeredSocket = false;

export const useNotificationsStore = defineStore('notifications', {
    state: () => ({
        notifications: [] as Notification[],
        loaded: false,
    }),
    getters: {
        unreadCount: (state) => state.notifications.filter(n => !n.read).length,
    },
    actions: {
        async fetch() {
            if (this.loaded) return;
            try {
                const res = await getNotifications();
                this.notifications = res.data;
                this.loaded = true;
            } catch {
                // non-critical — silently ignore
            }
        },
        async markAllRead() {
            await markAllRead();
            this.notifications = this.notifications.map(n => ({ ...n, read: true }));
        },
        addNew(notification: Notification) {
            this.notifications.unshift(notification);
        },
        connectSocket() {
            if (_registeredSocket) return;
            _registeredSocket = true;
            const socket = getSocket();
            socket.on('notification:new', (n: Notification) => this.addNew(n));
        },
        reset() {
            this.notifications = [];
            this.loaded = false;
            _registeredSocket = false;
        },
    },
});
