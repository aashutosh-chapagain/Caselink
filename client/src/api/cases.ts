import client from './client';

export interface CaseUser {
    _id: string;
    name: string;
    email: string;
}

export interface Case {
    _id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'closed';
    region: string;
    assignedTo: CaseUser | null;
    createdBy: CaseUser | null;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCasePayload {
    title: string;
    description: string;
    region: string;
}

export function getCases(status?: string) {
    const params = status ? { status } : {};
    return client.get<Case[]>('/cases', { params });
}

export function createCase(payload: CreateCasePayload) {
    return client.post<Case>('/cases', payload);
}

export function getCase(id: string) {
    return client.get<Case>(`/cases/${id}`);
}

export function updateCaseStatus(id: string, status: Case['status']) {
    return client.patch<Case>(`/cases/${id}`, { status });
}
