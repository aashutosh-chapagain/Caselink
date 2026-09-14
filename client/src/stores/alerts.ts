import { defineStore } from 'pinia';
import { getAlerts, type Alert } from '../api/alerts';
import { createSocket } from '../api/socket';

export const useAlertsStore = defineStore('alerts', {
    state: () => ({
        alerts: [] as Alert[],
        loaded: false,
    }),

    getters: {
        activeAlerts: (state) => state.alerts.filter(a => a.isActive),
        urgentAlerts: (state) => state.alerts.filter(a => a.isActive && (a.severity === 'critical' || a.severity === 'high')),
    },

    actions: {
        async fetchAlerts() {
            if (this.loaded) return;
            try {
                const res = await getAlerts();
                this.alerts = res.data;
                this.loaded = true;
            } catch {
                // fail silently — banner and dashboard will just show nothing
            }
        },

        connectSocket() {
            const socket = createSocket();

            socket.on('alert:created', (alert: Alert) => {
                this.alerts.unshift(alert);
            });

            socket.on('alert:updated', (updated: Alert) => {
                const idx = this.alerts.findIndex(a => a._id === updated._id);
                if (idx !== -1) this.alerts[idx] = updated;
            });

            return socket;
        },
    },
});
