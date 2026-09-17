import { defineStore } from 'pinia';
import { getAlerts, type Alert } from '../api/alerts';
import { getSocket } from '../api/socket';
import type { Socket } from 'socket.io-client';

// module-level ref so it survives store re-access but resets on module re-eval
let _registeredSocket: Socket | null = null;

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
            const socket = getSocket();

            // already listening on this exact socket instance — don't double-register
            if (_registeredSocket === socket) return;
            _registeredSocket = socket;

            socket.on('alert:created', (alert: Alert) => {
                this.alerts.unshift(alert);
            });

            socket.on('alert:updated', (updated: Alert) => {
                const idx = this.alerts.findIndex(a => a._id === updated._id);
                if (idx !== -1) this.alerts[idx] = updated;
            });
        },

        reset() {
            this.alerts = [];
            this.loaded = false;
            _registeredSocket = null;
        },
    },
});
