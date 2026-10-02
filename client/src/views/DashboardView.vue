<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { getDashboardStats, getDashboardActivity, type DashboardStats, type DashboardActivity } from '../api/dashboard';
import { useAuthStore } from '../stores/auth';
import StatCard from '../components/StatCard.vue';
import DashboardAlerts from '../components/DashboardAlerts.vue';
import StaleCasesTable from '../components/StaleCasesTable.vue';
import WorkloadTable from '../components/WorkloadTable.vue';
import ActivityFeed from '../components/ActivityFeed.vue';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { typeLabel } from '../utils/caseStyles';

const authStore = useAuthStore();

const stats = ref<DashboardStats | null>(null);
const activity = ref<DashboardActivity[]>([]);
const loading = ref(true);
const error = ref('');
const selectedDays = ref(7);

async function fetchData() {
    loading.value = true;
    error.value = '';
    try {
        const [statsRes, activityRes] = await Promise.all([
            getDashboardStats(selectedDays.value),
            getDashboardActivity(),
        ]);
        stats.value = statsRes.data;
        activity.value = activityRes.data;
    } catch {
        error.value = 'Failed to load dashboard data.';
    } finally {
        loading.value = false;
    }
}

onMounted(fetchData);
watch(selectedDays, fetchData);

const closedLabel = computed(() =>
    selectedDays.value === 7 ? 'Closed (7d)' :
    selectedDays.value === 30 ? 'Closed (30d)' : 'Closed (90d)'
);

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
        labels: { style: { fontSize: '11px' }, rotate: 0 },
        tickAmount: selectedDays.value > 14 ? 7 : undefined,
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


</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                        v-for="d in [7, 30, 90]"
                        :key="d"
                        @click="selectedDays = d"
                        class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                        :class="selectedDays === d ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                    >{{ d }}d</button>
                </div>
            </div>

            <div v-if="loading" class="text-slate-500 text-sm">Loading...</div>

            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ error }}
            </div>

            <template v-else-if="stats">

                <!-- Active alerts section -->
                <DashboardAlerts />

                <!-- Summary cards -->
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <StatCard label="Open" :value="stats.open" color="blue" />
                    <StatCard label="In Progress" :value="stats.inProgress" color="amber" />
                    <StatCard label="Critical Open" :value="stats.criticalOpen" color="red" sublabel="Needs immediate attention" />
                    <StatCard label="Overdue" :value="stats.overdueCount" :color="stats.overdueCount > 0 ? 'red' : 'slate'" sublabel="Past due date" />
                    <StatCard :label="closedLabel" :value="stats.closedInPeriod" color="green" />
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
                        <h2 class="text-sm font-semibold text-slate-700 mb-2">Cases Created — Last {{ selectedDays }} Days</h2>
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
                <StaleCasesTable v-if="stats.staleCases.length > 0" :cases="stats.staleCases" />

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <!-- Workload table (admin only) -->
                    <WorkloadTable v-if="authStore.isAdmin" :workload="stats.workload" />

                    <!-- Recent activity -->
                    <ActivityFeed :activity="activity" />

                </div>
            </template>
        </div>
    </div>
</template>
