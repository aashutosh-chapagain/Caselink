import client from './client';

export interface WorkspaceUser {
    _id: string;
    name: string;
    email: string;
    role: 'admin' | 'caseworker';
}

export function getUsers() {
    return client.get<WorkspaceUser[]>('/users');
}
