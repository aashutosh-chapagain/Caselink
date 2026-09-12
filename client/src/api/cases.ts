import client from './client';

export interface CaseUser {
    _id: string;
    name: string;
    email: string;
}

export type CasePriority = 'critical' | 'high' | 'medium' | 'low';
export type CaseType = 'fire' | 'medical' | 'welfare_check' | 'missing_person' | 'hazmat' | 'rescue' | 'other';

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
}

export interface CasesResponse {
    cases: Case[];
    hasMore: boolean;
}

export function getCases(params?: { status?: string; cursor?: string; limit?: number }) {
    return client.get<CasesResponse>('/cases', { params });
}

export function createCase(payload: CreateCasePayload) {
    return client.post<Case>('/cases', payload);
}

export function getCase(id: string) {
    return client.get<Case>(`/cases/${id}`);
}

export function updateCase(id: string, patch: { status?: Case['status']; assignedTo?: string; title?: string; description?: string; address?: string; lat?: number; lng?: number }) {
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
