import client from './client';

export interface Notification {
    _id: string;
    userId: string;
    type: 'assignment';
    message: string;
    caseId: string;
    read: boolean;
    createdAt: string;
}

export function getNotifications() {
    return client.get<Notification[]>('/notifications');
}

export function markAllRead() {
    return client.patch('/notifications/read');
}
