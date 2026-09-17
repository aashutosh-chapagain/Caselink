<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getAlerts, createAlert, toggleAlert, type Alert, type AlertSeverity } from '../api/alerts';
import { useAuthStore } from '../stores/auth';
import { getSocket } from '../api/socket';
import LocationPicker from '../components/LocationPicker.vue';
import AlertsMap from '../components/AlertsMap.vue';

const authStore = useAuthStore();

const alerts = ref<Alert[]>([]);
const loading = ref(true);
const error = ref('');

const activeAlerts = computed(() => alerts.value.filter(a => a.isActive));
const hasMapAlerts = computed(() => activeAlerts.value.some(a => a.lat != null));

// Create modal
const showModal = ref(false);
const submitting = ref(false);
const modalError = ref('');
const form = ref({ message: '', severity: 'info' as AlertSeverity, region: '', lat: undefined as number | undefined, lng: undefined as number | undefined });

const severityOptions: { label: string; value: AlertSeverity }[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Info', value: 'info' },
];

const severityBadgeStyles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
};

function openModal() {
    form.value = { message: '', severity: 'info', region: '', lat: undefined, lng: undefined };
    modalError.value = '';
    showModal.value = true;
}

async function submitAlert() {
    if (!form.value.message.trim()) {
        modalError.value = 'Message is required';
        return;
    }
    submitting.value = true;
    modalError.value = '';
    try {
        await createAlert({
            message: form.value.message.trim(),
            severity: form.value.severity,
            region: form.value.region.trim() || undefined,
            ...(form.value.lat !== undefined && form.value.lng !== undefined && {
                lat: form.value.lat,
                lng: form.value.lng,
            }),
        });
        showModal.value = false;
    } catch (err: any) {
        modalError.value = err.response?.data?.error || 'Failed to create alert';
    } finally {
        submitting.value = false;
    }
}

const toggling = ref<Set<string>>(new Set());

async function handleToggle(alert: Alert) {
    if (toggling.value.has(alert._id)) return;
    toggling.value.add(alert._id);
    try {
        await toggleAlert(alert._id);
    } finally {
        toggling.value.delete(alert._id);
    }
}

// Public link
const publicLink = `${window.location.origin}/alerts?workspace=${authStore.user?.workspaceId}`;
const copied = ref(false);

async function copyPublicLink() {
    await navigator.clipboard.writeText(publicLink);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

const socket = getSocket();

function onAlertCreated(alert: Alert) { alerts.value.unshift(alert); }
function onAlertUpdated(updated: Alert) {
    const idx = alerts.value.findIndex(a => a._id === updated._id);
    if (idx !== -1) alerts.value[idx] = updated;
}

onMounted(async () => {
    try {
        const res = await getAlerts();
        alerts.value = res.data;
    } catch {
        error.value = 'Failed to load alerts.';
    } finally {
        loading.value = false;
    }

    socket.on('alert:created', onAlertCreated);
    socket.on('alert:updated', onAlertUpdated);
});

onUnmounted(() => {
    socket.off('alert:created', onAlertCreated);
    socket.off('alert:updated', onAlertUpdated);
});
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-6xl mx-auto px-6 py-8">

            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Alerts</h1>
                    <p class="text-sm text-slate-500 mt-0.5">Manage public safety notices for your workspace</p>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        @click="copyPublicLink"
                        class="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
                    >
                        {{ copied ? 'Copied!' : 'Copy public link' }}
                    </button>
                    <button
                        @click="openModal"
                        class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + New Alert
                    </button>
                </div>
            </div>

            <div v-if="loading" class="text-slate-500 text-sm">Loading alerts...</div>

            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ error }}
            </div>

            <template v-else>

                <!-- Map — only shown when at least one active alert has coordinates -->
                <div v-if="hasMapAlerts" class="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h2 class="text-sm font-semibold text-slate-700">Active Alert Locations</h2>
                        <span class="text-xs text-slate-400">{{ activeAlerts.filter(a => a.lat != null).length }} pinned</span>
                    </div>
                    <AlertsMap :alerts="activeAlerts" />
                </div>

            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Message</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Severity</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Region</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="alerts.length === 0">
                            <td colspan="5" class="px-4 py-8 text-center text-slate-400">No alerts yet.</td>
                        </tr>
                        <tr
                            v-for="a in alerts"
                            :key="a._id"
                            class="border-b border-slate-100 last:border-0"
                            :class="{ 'opacity-50': !a.isActive }"
                        >
                            <td class="px-4 py-3 text-slate-800 max-w-xs">
                                <p class="truncate">{{ a.message }}</p>
                                <p class="text-xs text-slate-400 mt-0.5">{{ a.createdBy?.name ?? '—' }}</p>
                            </td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="severityBadgeStyles[a.severity]"
                                >
                                    {{ a.severity }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-slate-500">{{ a.region ?? '—' }}</td>
                            <td class="px-4 py-3 text-slate-500">{{ formatDateTime(a.createdAt) }}</td>
                            <td class="px-4 py-3">
                                <button
                                    @click="handleToggle(a)"
                                    :disabled="toggling.has(a._id)"
                                    class="text-xs font-medium px-3 py-1 rounded-lg border transition-colors disabled:opacity-40"
                                    :class="a.isActive
                                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                                        : 'border-green-200 text-green-600 hover:bg-green-50'"
                                >
                                    {{ a.isActive ? 'Deactivate' : 'Activate' }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            </template>

        </div>
    </div>

    <!-- Create alert modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showModal = false">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 class="text-lg font-semibold text-slate-800 mb-4">New Alert</h2>
            <form @submit.prevent="submitAlert" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Message</label>
                    <textarea
                        v-model="form.message"
                        rows="3"
                        required
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none"
                        placeholder="e.g. Bushfire warning — avoid Kalamunda Hills area"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Severity</label>
                    <select
                        v-model="form.severity"
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700"
                    >
                        <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                        </option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Location <span class="text-slate-400 font-normal">(optional)</span></label>
                    <LocationPicker
                        @select="({ address, lat, lng, region }) => {
                            form.region = region || address;
                            form.lat = lat || undefined;
                            form.lng = lng || undefined;
                        }"
                    />
                </div>
                <p v-if="modalError" class="text-red-600 text-sm">{{ modalError }}</p>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" @click="showModal = false" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                    <button
                        type="submit"
                        :disabled="submitting"
                        class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {{ submitting ? 'Creating...' : 'Create Alert' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
