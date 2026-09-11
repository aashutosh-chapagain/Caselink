<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCasesStore } from '../stores/cases';
import { createCase, type Case, type CasePriority, type CaseType } from '../api/cases';
import { createSocket } from '../api/socket';

const casesStore = useCasesStore();

const showModal = ref(false);
const submitting = ref(false);
const modalError = ref('');
const form = ref({ title: '', description: '', region: '', priority: 'medium' as CasePriority, type: '' as CaseType | '' });

const priorityOptions: { label: string; value: CasePriority }[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
];

const caseTypeOptions: { label: string; value: CaseType }[] = [
    { label: 'Fire', value: 'fire' },
    { label: 'Medical', value: 'medical' },
    { label: 'Welfare Check', value: 'welfare_check' },
    { label: 'Missing Person', value: 'missing_person' },
    { label: 'Hazmat', value: 'hazmat' },
    { label: 'Rescue', value: 'rescue' },
    { label: 'Other', value: 'other' },
];

function openModal() {
    form.value = { title: '', description: '', region: '', priority: 'medium', type: '' };
    modalError.value = '';
    showModal.value = true;
}

async function submitCase() {
    if (!form.value.type) {
        modalError.value = 'Please select a case type';
        return;
    }
    submitting.value = true;
    modalError.value = '';
    try {
        await createCase(form.value as Parameters<typeof createCase>[0]);
        showModal.value = false;
    } catch (err: any) {
        modalError.value = err.response?.data?.error || 'Failed to create case';
    } finally {
        submitting.value = false;
    }
}

const tabs = [
    { label: 'All', value: undefined },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Closed', value: 'closed' },
];

const activeTab = ref<string | undefined>(undefined);

const displayedCases = computed(() => {
    if (activeTab.value === 'closed') return casesStore.closedCases;
    if (activeTab.value) return casesStore.activeCases.filter(c => c.status === activeTab.value);
    return casesStore.activeCases;
});

const isLoading = computed(() =>
    activeTab.value === 'closed' ? casesStore.closedLoading : casesStore.loading
);

function selectTab(value: string | undefined) {
    activeTab.value = value;
    if (value === 'closed' && casesStore.closedCases.length === 0) {
        casesStore.fetchClosedCases();
    }
}

const socket = createSocket();

onMounted(() => {
    casesStore.fetchActiveCases();

    socket.on('case:created', (newCase: Case) => {
        casesStore.addCase(newCase);
    });

    socket.on('case:updated', (updated: Case) => {
        casesStore.updateCase(updated);
    });
});

onUnmounted(() => {
    socket.disconnect();
});

const statusStyles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    closed: 'bg-gray-100 text-gray-600',
};

const statusLabel: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    closed: 'Closed',
};

const priorityStyles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
};

const priorityLabel: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const typeLabel: Record<string, string> = {
    fire: 'Fire',
    medical: 'Medical',
    welfare_check: 'Welfare Check',
    missing_person: 'Missing Person',
    hazmat: 'Hazmat',
    rescue: 'Rescue',
    other: 'Other',
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold text-slate-800">Cases</h1>
                <button
                    @click="openModal"
                    class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + New Case
                </button>
            </div>

            <!-- Filter tabs -->
            <div class="flex gap-1 mb-6 border-b border-slate-200">
                <button
                    v-for="tab in tabs"
                    :key="tab.label"
                    @click="selectTab(tab.value)"
                    class="px-4 py-2 text-sm font-medium rounded-t transition-colors"
                    :class="activeTab === tab.value
                        ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                        : 'text-slate-500 hover:text-slate-700'"
                >
                    {{ tab.label }}
                </button>
            </div>

            <!-- Error -->
            <div v-if="casesStore.error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ casesStore.error }}
            </div>

            <!-- Loading -->
            <div v-if="isLoading" class="text-slate-500 text-sm">Loading cases...</div>

            <!-- Table -->
            <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Region</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Assigned To</th>
                            <th class="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="displayedCases.length === 0">
                            <td colspan="7" class="px-4 py-8 text-center text-slate-400">No cases found.</td>
                        </tr>
                        <tr
                            v-for="c in displayedCases"
                            :key="c._id"
                            class="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                            @click="$router.push(`/cases/${c._id}`)"
                        >
                            <td class="px-4 py-3 font-medium text-slate-800">{{ c.title }}</td>
                            <td class="px-4 py-3 text-slate-600 text-xs">{{ typeLabel[c.type] ?? c.type }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="priorityStyles[c.priority]"
                                >
                                    {{ priorityLabel[c.priority] }}
                                </span>
                            </td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="statusStyles[c.status]"
                                >
                                    {{ statusLabel[c.status] }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-slate-600">{{ c.region }}</td>
                            <td class="px-4 py-3 text-slate-600">{{ c.assignedTo?.name ?? '—' }}</td>
                            <td class="px-4 py-3 text-slate-500">{{ formatDate(c.createdAt) }}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Load more (closed tab only) -->
                <div v-if="activeTab === 'closed' && casesStore.closedHasMore" class="px-4 py-3 border-t border-slate-100 text-center">
                    <button
                        @click="casesStore.loadMoreClosed()"
                        :disabled="casesStore.closedLoading"
                        class="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                    >
                        {{ casesStore.closedLoading ? 'Loading...' : 'Load more' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Create case modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showModal = false">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 class="text-lg font-semibold text-slate-800 mb-4">New Case</h2>

            <form @submit.prevent="submitCase" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Title</label>
                    <input
                        v-model="form.title"
                        type="text"
                        required
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Case title"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Description</label>
                    <textarea
                        v-model="form.description"
                        required
                        rows="3"
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-none"
                        placeholder="Brief description"
                    />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Case Type</label>
                        <select
                            v-model="form.type"
                            required
                            class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700"
                        >
                            <option value="" disabled>Select type…</option>
                            <option v-for="opt in caseTypeOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Priority</label>
                        <select
                            v-model="form.priority"
                            required
                            class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700"
                        >
                            <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Region</label>
                    <input
                        v-model="form.region"
                        type="text"
                        required
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                        placeholder="e.g. Perth Metro"
                    />
                </div>

                <p v-if="modalError" class="text-red-600 text-sm">{{ modalError }}</p>

                <div class="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        @click="showModal = false"
                        class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="submitting"
                        class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {{ submitting ? 'Creating...' : 'Create Case' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>
