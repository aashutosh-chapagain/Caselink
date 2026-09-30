import client from './client';

export interface CaseUser {
    _id: string;
    name: string;
    email: string;
}

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type CaseType = 'fire' | 'medical' | 'welfare_check' | 'missing_person' | 'hazmat' | 'rescue' | 'other';

export interface LinkedCase {
    _id: string;
    title: string;
    status: 'open' | 'in_progress' | 'closed';
    priority: CasePriority;
    type: CaseType;
    region: string;
}

export interface Case {
    _id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'closed';
    priority: CasePriority;
    type: CaseType;
    region: string;
    address?: string;
    lat?: number;
    lng?: number;
    assignedTo: CaseUser | null;
    createdBy: CaseUser | null;
    workspaceId: string;
    dueAt?: string | null;
    linkedCaseIds: LinkedCase[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateCasePayload {
    title: string;
    description: string;
    region: string;
    priority: CasePriority;
    type: CaseType;
    address?: string;
    lat?: number;
    lng?: number;
    dueAt?: string | null;
}

export interface CasesResponse {
    cases: Case[];
    hasMore: boolean;
}

export function getCases(params?: { status?: string; cursor?: string; limit?: number; search?: string }) {
    return client.get<CasesResponse>('/cases', { params });
}

export function exportCases(params?: { status?: string; search?: string; overdue?: string }) {
    return client.get('/cases/export', { params, responseType: 'blob' });
}

export function bulkUpdateCases(ids: string[], status: string) {
    return client.patch<{ updated: number }>('/cases/bulk', { ids, status });
}

export function createCase(payload: CreateCasePayload) {
    return client.post<Case>('/cases', payload);
}

export function getCase(id: string) {
    return client.get<Case>(`/cases/${id}`);
}

export function updateCase(id: string, patch: { status?: Case['status']; assignedTo?: string; title?: string; description?: string; address?: string; lat?: number; lng?: number; dueAt?: string | null }) {
    return client.patch<Case>(`/cases/${id}`, patch);
}

export interface Activity {
    _id: string;
    caseId: string;
    authorId: CaseUser | null;
    note: string;
    type: 'note' | 'status_change' | 'assignment' | 'update';
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
}

export interface ActivitiesResponse {
    activities: Activity[];
    hasMore: boolean;
}

export function getActivities(caseId: string, params?: { limit?: number; before?: string }) {
    return client.get<ActivitiesResponse>(`/cases/${caseId}/activities`, { params });
}

export function addActivity(caseId: string, note: string) {
    return client.post<Activity>(`/cases/${caseId}/activities`, { note });
}

export function linkCase(id: string, caseId: string) {
    return client.post<Case>(`/cases/${id}/links`, { caseId });
}

export function unlinkCase(id: string, linkedId: string) {
    return client.delete<Case>(`/cases/${id}/links/${linkedId}`);
}
