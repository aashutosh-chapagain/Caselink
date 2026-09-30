import { formatDate } from './format';

export const priorityStyles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
};

export const priorityLabel: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export const statusStyles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    closed: 'bg-gray-100 text-gray-600',
};

export const statusLabel: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
};

export const typeLabel: Record<string, string> = {
    fire: 'Fire',
    medical: 'Medical',
    welfare_check: 'Welfare Check',
    missing_person: 'Missing Person',
    hazmat: 'Hazmat',
    rescue: 'Rescue',
    other: 'Other',
};

export function dueBadge(dueAt?: string | null): { label: string; cls: string } | null {
    if (!dueAt) return null;
    const now = new Date();
    const due = new Date(dueAt);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Overdue', cls: 'text-red-600' };
    if (diffDays === 0) return { label: 'Due today', cls: 'text-orange-600' };
    if (diffDays <= 3) return { label: `Due in ${diffDays}d`, cls: 'text-yellow-600' };
    return { label: `Due ${formatDate(dueAt)}`, cls: 'text-slate-400' };
}

export function dueBadgeClass(dueAt: string): string {
    const diffDays = Math.ceil((new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'text-red-600 font-semibold';
    if (diffDays === 0) return 'text-orange-600 font-medium';
    if (diffDays <= 3) return 'text-yellow-600';
    return 'text-slate-700';
}
