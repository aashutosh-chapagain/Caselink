<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { StaleCase } from '../api/dashboard';
import { priorityStyles } from '../utils/caseStyles';
import { formatDateTime } from '../utils/format';

defineProps<{ cases: StaleCase[] }>();

const router = useRouter();
</script>

<template>
    <div class="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
        <h2 class="text-sm font-semibold text-amber-700 mb-1">Stale Cases</h2>
        <p class="text-xs text-slate-400 mb-4">Active cases with no activity in the last 7 days</p>
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b border-slate-100">
                    <th class="text-left py-2 font-medium text-slate-500">Title</th>
                    <th class="text-left py-2 font-medium text-slate-500">Priority</th>
                    <th class="text-left py-2 font-medium text-slate-500">Assigned To</th>
                    <th class="text-left py-2 font-medium text-slate-500">Created</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="c in cases"
                    :key="c._id"
                    class="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                    @click="router.push(`/cases/${c._id}`)"
                >
                    <td class="py-2 text-slate-700 font-medium">{{ c.title }}</td>
                    <td class="py-2">
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="priorityStyles[c.priority]">
                            {{ c.priority }}
                        </span>
                    </td>
                    <td class="py-2 text-slate-600">{{ c.assignedTo?.name ?? '—' }}</td>
                    <td class="py-2 text-slate-400 text-xs">{{ formatDateTime(c.createdAt) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
