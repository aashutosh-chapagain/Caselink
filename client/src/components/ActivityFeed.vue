<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { DashboardActivity } from '../api/dashboard';
import { formatDateTime } from '../utils/format';

defineProps<{ activity: DashboardActivity[] }>();

const router = useRouter();

const activityTypeLabel: Record<string, string> = {
    note: 'Note',
    status_change: 'Status',
    assignment: 'Assignment',
};

const activityTypeStyles: Record<string, string> = {
    note: 'bg-slate-100 text-slate-600',
    status_change: 'bg-blue-50 text-blue-600',
    assignment: 'bg-purple-50 text-purple-600',
};
</script>

<template>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 class="text-sm font-semibold text-slate-700 mb-4">Recent Activity</h2>
        <div v-if="activity.length === 0" class="text-sm text-slate-400">No recent activity.</div>
        <ul v-else class="space-y-3">
            <li v-for="a in activity" :key="a._id" class="flex gap-3">
                <div class="mt-1.5 w-2 h-2 rounded-full bg-slate-300 shrink-0"></div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-0.5">
                        <span class="text-xs font-medium text-slate-700">{{ a.authorId?.name ?? 'System' }}</span>
                        <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="activityTypeStyles[a.type]">
                            {{ activityTypeLabel[a.type] }}
                        </span>
                        <span class="text-xs text-slate-400">{{ formatDateTime(a.createdAt) }}</span>
                    </div>
                    <button
                        v-if="a.caseId"
                        @click="router.push(`/cases/${a.caseId._id}`)"
                        class="text-xs text-blue-600 hover:underline truncate block max-w-full text-left"
                    >
                        {{ a.caseId.title }}
                    </button>
                    <p class="text-xs text-slate-500 mt-0.5">{{ a.note }}</p>
                </div>
            </li>
        </ul>
    </div>
</template>
