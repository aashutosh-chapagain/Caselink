import client from './client';

export interface WorkspaceUser {
    _id: string;
    name: string;
    email: string;
    role: 'admin' | 'caseworker';
    isActive: boolean;
}

export interface MyProfile {
    _id: string;
    name: string;
    email: string;
    role: 'admin' | 'caseworker';
    workspaceName: string;
}

export function getUsers() {
    return client.get<WorkspaceUser[]>('/users');
}

export function getMyProfile() {
    return client.get<MyProfile>('/users/me');
}

export function updateMyProfile(name: string) {
    return client.patch<{ name: string; email: string; role: string }>('/users/me', { name });
}

export function changePassword(currentPassword: string, newPassword: string) {
    return client.patch('/users/me/password', { currentPassword, newPassword });
}

export function toggleUserActive(id: string) {
    return client.patch<WorkspaceUser>(`/users/${id}/active`);
}
