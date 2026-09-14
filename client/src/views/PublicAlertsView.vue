<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { getPublicAlerts, type Alert } from '../api/alerts';

const route = useRoute();
const workspaceId = route.query.workspace as string | undefined;

const alerts = ref<Alert[]>([]);
const loading = ref(true);
const error = ref('');

// Public page has no JWT so Socket.IO auth would fail.
// Poll every 30 seconds for live updates instead.
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchAlerts() {
    if (!workspaceId) return;
    try {
        const res = await getPublicAlerts(workspaceId);
        alerts.value = res.data;
        error.value = '';
    } catch {
        error.value = 'Failed to load alerts.';
    }
}

onMounted(async () => {
    if (!workspaceId) {
        error.value = 'No workspace specified. Add ?workspace=<id> to the URL.';
        loading.value = false;
        return;
    }
    await fetchAlerts();
    loading.value = false;
    pollTimer = setInterval(fetchAlerts, 30_000);
});

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
});

const severityStyles: Record<string, string> = {
    critical: 'border-red-400 bg-red-50',
    high: 'border-orange-400 bg-orange-50',
    medium: 'border-yellow-400 bg-yellow-50',
    info: 'border-blue-300 bg-blue-50',
};

const severityBadgeStyles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
};

const severityLabel: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    info: 'Info',
};

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-2xl mx-auto px-6 py-12">

            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-2xl font-bold text-slate-800">Active Alerts</h1>
                <p class="text-sm text-slate-500 mt-1">Live public safety notices. Refreshes every 30 seconds.</p>
            </div>

            <!-- Loading -->
            <div v-if="loading" class="text-slate-500 text-sm">Loading alerts...</div>

            <!-- Error -->
            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ error }}
            </div>

            <!-- No alerts -->
            <div v-else-if="alerts.length === 0" class="text-center py-16">
                <p class="text-slate-400 text-sm">No active alerts at this time.</p>
            </div>

            <!-- Alert list -->
            <ul v-else class="space-y-4">
                <li
                    v-for="a in alerts"
                    :key="a._id"
                    class="rounded-xl border-l-4 p-5 shadow-sm"
                    :class="severityStyles[a.severity]"
                >
                    <div class="flex items-start justify-between gap-4">
                        <p class="text-slate-800 font-medium text-sm leading-relaxed">{{ a.message }}</p>
                        <span
                            class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                            :class="severityBadgeStyles[a.severity]"
                        >
                            {{ severityLabel[a.severity] }}
                        </span>
                    </div>
                    <div class="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span v-if="a.region">📍 {{ a.region }}</span>
                        <span>{{ formatDateTime(a.createdAt) }}</span>
                    </div>
                </li>
            </ul>

        </div>
    </div>
</template>
