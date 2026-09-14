<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getDashboardStats, getDashboardActivity, type DashboardStats, type DashboardActivity } from '../api/dashboard';
import { useAuthStore } from '../stores/auth';
import StatCard from '../components/StatCard.vue';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';

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

const typeLabel: Record<string, string> = {
    fire: 'Fire',
    medical: 'Medical',
    welfare_check: 'Welfare Check',
    missing_person: 'Missing Person',
    hazmat: 'Hazmat',
    rescue: 'Rescue',
    other: 'Other',
};

// Donut chart — priority breakdown
const prioritySeries = computed(() => [
    stats.value?.byPriority.critical ?? 0,
    stats.value?.byPriority.high ?? 0,
    stats.value?.byPriority.medium ?? 0,
    stats.value?.byPriority.low ?? 0,
]);

const priorityChartOptions = computed((): ApexOptions => ({
    chart: { type: 'donut' as const, toolbar: { show: false } },
    labels: ['Critical', 'High', 'Medium', 'Low'],
    colors: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
    legend: { position: 'bottom', fontSize: '13px' },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '65%' } } },
    stroke: { width: 0 },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? 's' : ''}` } },
}));

// Sparkline — cases created per day (last 7 days)
const trendSeries = computed(() => [{
    name: 'Cases',
    data: stats.value?.trend.map(d => d.count) ?? [],
}]);

const trendChartOptions = computed((): ApexOptions => ({
    chart: { type: 'area' as const, toolbar: { show: false }, sparkline: { enabled: false } },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05 } },
    colors: ['#3b82f6'],
    xaxis: {
        categories: stats.value?.trend.map(d =>
            new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        ) ?? [],
        labels: { style: { fontSize: '11px' } },
    },
    yaxis: { labels: { style: { fontSize: '11px' } }, min: 0, forceNiceScale: true },
    dataLabels: { enabled: false },
    grid: { borderColor: '#f1f5f9' },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? 's' : ''}` } },
}));

// Horizontal bar chart — case type breakdown
const typeSeries = computed(() => [{
    name: 'Cases',
    data: Object.keys(stats.value?.byType ?? {}).map(k => stats.value!.byType[k]),
}]);

const typeChartOptions = computed((): ApexOptions => ({
    chart: { type: 'bar' as const, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
    xaxis: {
        categories: Object.keys(stats.value?.byType ?? {}).map(k => typeLabel[k] ?? k),
        labels: { style: { fontSize: '12px' } },
    },
    colors: ['#3b82f6'],
    dataLabels: { enabled: false },
    grid: { borderColor: '#f1f5f9', xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? 's' : ''}` } },
}));

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
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard label="Open" :value="stats.open" color="blue" />
                    <StatCard label="In Progress" :value="stats.inProgress" color="amber" />
                    <StatCard label="Critical Open" :value="stats.criticalOpen" color="red" sublabel="Needs immediate attention" />
                    <StatCard label="Closed This Month" :value="stats.closedThisMonth" color="green" />
                </div>

                <!-- Second row: unassigned + trend -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <StatCard
                        v-if="authStore.isAdmin"
                        label="Unassigned Cases"
                        :value="stats.unassigned"
                        :color="stats.unassigned > 0 ? 'red' : 'slate'"
                        sublabel="Active cases with no caseworker"
                    />
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5" :class="authStore.isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'">
                        <h2 class="text-sm font-semibold text-slate-700 mb-2">Cases Created — Last 7 Days</h2>
                        <VueApexCharts
                            type="area"
                            height="120"
                            :options="trendChartOptions"
                            :series="trendSeries"
                        />
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                    <!-- Priority donut chart -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 class="text-sm font-semibold text-slate-700 mb-2">Active Cases by Priority</h2>
                        <div v-if="prioritySeries.every(v => v === 0)" class="text-sm text-slate-400 py-8 text-center">No active cases.</div>
                        <VueApexCharts
                            v-else
                            type="donut"
                            height="280"
                            :options="priorityChartOptions"
                            :series="prioritySeries"
                        />
                    </div>

                    <!-- Type horizontal bar chart -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h2 class="text-sm font-semibold text-slate-700 mb-2">Active Cases by Type</h2>
                        <div v-if="Object.keys(stats.byType).length === 0" class="text-sm text-slate-400 py-8 text-center">No active cases.</div>
                        <VueApexCharts
                            v-else
                            type="bar"
                            height="280"
                            :options="typeChartOptions"
                            :series="typeSeries"
                        />
                    </div>

                </div>

                <!-- Stale cases -->
                <div v-if="stats.staleCases.length > 0" class="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
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
                                v-for="c in stats.staleCases"
                                :key="c._id"
                                class="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                                @click="router.push(`/cases/${c._id}`)"
                            >
                                <td class="py-2 text-slate-700 font-medium">{{ c.title }}</td>
                                <td class="py-2">
                                    <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="{
                                        'bg-red-100 text-red-700': c.priority === 'critical',
                                        'bg-orange-100 text-orange-700': c.priority === 'high',
                                        'bg-yellow-100 text-yellow-700': c.priority === 'medium',
                                        'bg-green-100 text-green-700': c.priority === 'low',
                                    }">{{ c.priority }}</span>
                                </td>
                                <td class="py-2 text-slate-600">{{ c.assignedTo?.name ?? '—' }}</td>
                                <td class="py-2 text-slate-400 text-xs">{{ formatDateTime(c.createdAt) }}</td>
                            </tr>
                        </tbody>
                    </table>
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
