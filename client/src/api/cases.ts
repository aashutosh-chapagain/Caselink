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

export function updateCase(id: string, patch: { status?: Case['status']; assignedTo?: string }) {
    return client.patch<Case>(`/cases/${id}`, patch);
}

export interface Activity {
    _id: string;
    caseId: string;
    authorId: CaseUser | null;
    note: string;
    type: 'note' | 'status_change' | 'assignment';
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
}

export function getActivities(caseId: string) {
    return client.get<Activity[]>(`/cases/${caseId}/activities`);
}

export function addActivity(caseId: string, note: string) {
    return client.post<Activity>(`/cases/${caseId}/activities`, { note });
}
