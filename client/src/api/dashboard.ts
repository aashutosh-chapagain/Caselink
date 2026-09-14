import client from './client';

export interface StaleCase {
    _id: string;
    title: string;
    priority: string;
    status: string;
    assignedTo: { _id: string; name: string } | null;
    createdAt: string;
}

export interface TrendDay {
    date: string;
    count: number;
}

export interface DashboardStats {
    open: number;
    inProgress: number;
    criticalOpen: number;
    closedThisMonth: number;
    unassigned: number;
    byPriority: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    byType: Record<string, number>;
    workload: WorkloadRow[];
    staleCases: StaleCase[];
    trend: TrendDay[];
}

export interface WorkloadRow {
    _id: string;
    name: string;
    open: number;
    inProgress: number;
}

export interface DashboardActivity {
    _id: string;
    caseId: { _id: string; title: string } | null;
    authorId: { _id: string; name: string } | null;
    note: string;
    type: 'note' | 'status_change' | 'assignment';
    createdAt: string;
}

export function getDashboardStats() {
    return client.get<DashboardStats>('/dashboard/stats');
}

export function getDashboardActivity() {
    return client.get<DashboardActivity[]>('/dashboard/activity');
}
