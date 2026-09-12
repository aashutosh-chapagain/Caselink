<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getDashboardStats, getDashboardActivity, type DashboardStats, type DashboardActivity } from '../api/dashboard';
import { useAuthStore } from '../stores/auth';
import StatCard from '../components/StatCard.vue';
import BreakdownBar from '../components/BreakdownBar.vue';

const router = useRouter();
const authStore = useAuthStore();

const stats = ref<DashboardStats | null>(null);
const activity = ref<DashboardActivity[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
    try {
        const [statsRes, activityRes] = await Promise.all([
            getDashboardStats(),
            getDashboardActivity(),
        ]);
        stats.value = statsRes.data;
        activity.value = activityRes.data;
    } catch {
        error.value = 'Failed to load dashboard data.';
    } finally {
        loading.value = false;
    }
});

const totalActive = computed(() => (stats.value ? stats.value.open + stats.value.inProgress : 0));

const typeLabel: Record<string, string> = {
    fire: 'Fire',
    medical: 'Medical',
    welfare_check: 'Welfare Check',
    missing_person: 'Missing Person',
    hazmat: 'Hazmat',
    rescue: 'Rescue',
    other: 'Other',
};

const priorityBarColor: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-yellow-400',
    low: 'bg-green-400',
};

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

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <h1 class="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

            <div v-if="loading" class="text-slate-500 text-sm">Loading...</div>

            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ error }}
            </div>

            <template v-else-if="stats">

                <!-- Summary cards -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Open" :value="stats.open" color="blue" />
                    <StatCard label="In Progress" :value="stats.inProgress" color="amber" />
                    <StatCard label="Critical Open" :value="stats.criticalOpen" color="red" sublabel="Needs immediate attention" />
                    <StatCard label="Closed This Month" :value="stats.closedThisMonth" color="green" />
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                    <!-- Priority breakdown -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 class="text-sm font-semibold text-slate-700 mb-4">Active Cases by Priority</h2>
                        <div v-if="totalActive === 0" class="text-sm text-slate-400">No active cases.</div>
                        <div v-else class="space-y-3">
                            <BreakdownBar
                                v-for="(p, key) in stats.byPriority"
                                :key="key"
                                :label="key.charAt(0).toUpperCase() + key.slice(1)"
                                :count="p"
                                :total="totalActive"
                                :color="priorityBarColor[key]"
                            />
                        </div>
                    </div>

                    <!-- Type breakdown -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 class="text-sm font-semibold text-slate-700 mb-4">Active Cases by Type</h2>
                        <div v-if="totalActive === 0" class="text-sm text-slate-400">No active cases.</div>
                        <div v-else class="space-y-3">
                            <BreakdownBar
                                v-for="(count, key) in stats.byType"
                                :key="key"
                                :label="typeLabel[key] ?? key"
                                :count="count"
                                :total="totalActive"
                                color="bg-blue-400"
                            />
                        </div>
                    </div>

                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <!-- Workload table (admin only) -->
                    <div v-if="authStore.isAdmin" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 class="text-sm font-semibold text-slate-700 mb-4">Caseworker Workload</h2>
                        <div v-if="stats.workload.length === 0" class="text-sm text-slate-400">No assigned cases.</div>
                        <table v-else class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-slate-100">
                                    <th class="text-left py-2 font-medium text-slate-500">Caseworker</th>
                                    <th class="text-right py-2 font-medium text-slate-500">Open</th>
                                    <th class="text-right py-2 font-medium text-slate-500">In Progress</th>
                                    <th class="text-right py-2 font-medium text-slate-500">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="row in stats.workload"
                                    :key="row._id"
                                    class="border-b border-slate-50 last:border-0"
                                >
                                    <td class="py-2 text-slate-700">{{ row.name ?? '—' }}</td>
                                    <td class="py-2 text-right text-blue-600">{{ row.open }}</td>
                                    <td class="py-2 text-right text-amber-500">{{ row.inProgress }}</td>
                                    <td class="py-2 text-right font-medium text-slate-700">{{ row.open + row.inProgress }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Recent activity -->
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

                </div>
            </template>
        </div>
    </div>
</template>
