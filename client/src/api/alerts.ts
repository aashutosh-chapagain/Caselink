import client from './client';
import publicClient from './publicClient';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface Alert {
    _id: string;
    message: string;
    severity: AlertSeverity;
    region?: string;
    lat?: number;
    lng?: number;
    isActive: boolean;
    createdBy: { _id: string; name: string } | null;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateAlertPayload {
    message: string;
    severity: AlertSeverity;
    region?: string;
    lat?: number;
    lng?: number;
}

// Public — no auth, requires workspaceId query param
export function getPublicAlerts(workspaceId: string) {
    return publicClient.get<Alert[]>('/alerts/public', { params: { workspaceId } });
}

// Authenticated — all alerts for the workspace (active + inactive)
export function getAlerts() {
    return client.get<Alert[]>('/alerts');
}

// Admin only
export function createAlert(payload: CreateAlertPayload) {
    return client.post<Alert>('/alerts', payload);
}

// Admin only — toggles isActive
export function toggleAlert(id: string) {
    return client.patch<Alert>(`/alerts/${id}`);
}
