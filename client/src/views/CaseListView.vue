<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCasesStore } from '../stores/cases';
import { useAuthStore } from '../stores/auth';
import { getCases, exportCases, bulkUpdateCases, type Case } from '../api/cases';
import { getUsers, type WorkspaceUser } from '../api/users';
import { getSocket } from '../api/socket';
import CasesMap from '../components/CasesMap.vue';
import { priorityStyles, priorityLabel, statusStyles, statusLabel, typeLabel, dueBadge } from '../utils/caseStyles';
import { formatDate } from '../utils/format';

const router = useRouter();

const casesStore = useCasesStore();
const authStore = useAuthStore();

const exporting = ref(false);
const users = ref<WorkspaceUser[]>([]);

// Advanced filters
const filterType = ref('');
const filterAssignee = ref('');
const bulkUpdating = ref(false);
const selectedIds = ref<Set<string>>(new Set());

const tabs = [
    { label: 'All', value: undefined },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'Closed', value: 'closed' },
    { label: 'Map', value: 'map' },
];

const activeTab = ref<string | undefined>(undefined);

// Search state
const searchQuery = ref('');
const searchResults = ref<Case[]>([]);
const searchLoading = ref(false);
const isSearching = computed(() => searchQuery.value.trim().length > 0);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, (val) => {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!val.trim()) {
        searchResults.value = [];
        return;
    }
    searchDebounce = setTimeout(async () => {
        searchLoading.value = true;
        try {
            const res = await getCases({ search: val.trim() });
            searchResults.value = res.data.cases;
        } catch {
            searchResults.value = [];
        } finally {
            searchLoading.value = false;
        }
    }, 300);
});

const displayedCases = computed(() => {
    const now = new Date();
    const isOverdue = (c: Case) => !!c.dueAt && new Date(c.dueAt) < now;

    let base: Case[];
    if (isSearching.value) {
        if (activeTab.value === 'overdue') base = searchResults.value.filter(isOverdue);
        else if (!activeTab.value || activeTab.value === 'map') base = searchResults.value;
        else base = searchResults.value.filter(c => c.status === activeTab.value);
    } else if (activeTab.value === 'overdue') {
        base = casesStore.activeCases.filter(isOverdue);
    } else if (activeTab.value === 'closed') {
        base = casesStore.closedCases;
    } else if (activeTab.value === 'map' || activeTab.value === undefined) {
        base = casesStore.activeCases;
    } else {
        base = casesStore.activeCases.filter(c => c.status === activeTab.value);
    }

    if (filterType.value) base = base.filter(c => c.type === filterType.value);
    if (filterAssignee.value) base = base.filter(c => c.assignedTo?._id === filterAssignee.value);

    return base;
});

const isLoading = computed(() => {
    if (isSearching.value) return searchLoading.value;
    return activeTab.value === 'closed' ? casesStore.closedLoading : casesStore.loading;
});

const allSelected = computed(() =>
    displayedCases.value.length > 0 &&
    displayedCases.value.every(c => selectedIds.value.has(c._id))
);
const someSelected = computed(() =>
    displayedCases.value.some(c => selectedIds.value.has(c._id)) && !allSelected.value
);

function selectTab(value: string | undefined) {
    activeTab.value = value;
    selectedIds.value = new Set();
    if (!isSearching.value && value === 'closed' && casesStore.closedCases.length === 0) {
        casesStore.fetchClosedCases();
    }
}

function toggleSelect(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
}

function toggleSelectAll() {
    selectedIds.value = allSelected.value
        ? new Set()
        : new Set(displayedCases.value.map(c => c._id));
}

async function bulkUpdateStatus(status: string) {
    if (selectedIds.value.size === 0) return;
    bulkUpdating.value = true;
    try {
        await bulkUpdateCases([...selectedIds.value], status);
        selectedIds.value = new Set();
    } catch {
        // silently ignore
    } finally {
        bulkUpdating.value = false;
    }
}

const mappableCases = computed(() => {
    const source = isSearching.value ? searchResults.value : casesStore.activeCases;
    let filtered = source.filter(c => c.lat != null && c.lng != null);
    if (filterType.value) filtered = filtered.filter(c => c.type === filterType.value);
    if (filterAssignee.value) filtered = filtered.filter(c => c.assignedTo?._id === filterAssignee.value);
    return filtered;
});

const socket = getSocket();

function onCaseCreated(newCase: Case) { casesStore.addCase(newCase); }
function onCaseUpdated(updated: Case) { casesStore.updateCase(updated); }

onMounted(() => {
    casesStore.fetchActiveCases();
    if (authStore.isAdmin) {
        getUsers().then(res => { users.value = res.data; }).catch(() => {});
    }
    socket.on('case:created', onCaseCreated);
    socket.on('case:updated', onCaseUpdated);
});

onUnmounted(() => {
    socket.off('case:created', onCaseCreated);
    socket.off('case:updated', onCaseUpdated);
});

async function downloadCsv() {
    exporting.value = true;
    try {
        const params: Record<string, string> = {};
        if (activeTab.value === 'overdue') {
            params.overdue = 'true';
        } else if (activeTab.value && activeTab.value !== 'map') {
            params.status = activeTab.value;
        }
        if (isSearching.value) params.search = searchQuery.value.trim();

        const res = await exportCases(params);
        const url = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cases-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        // silently ignore — network errors handled by axios interceptor
    } finally {
        exporting.value = false;
    }
}

</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-6xl mx-auto px-6 py-8">
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-2xl font-bold text-slate-800">Cases</h1>
                <div class="flex items-center gap-2">
                    <button
                        @click="downloadCsv"
                        :disabled="exporting"
                        class="text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        {{ exporting ? 'Exporting…' : 'Export CSV' }}
                    </button>
                    <button
                        @click="router.push('/cases/new')"
                        class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        + New Case
                    </button>
                </div>
            </div>

            <!-- Search -->
            <div class="relative mb-4">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search by title, description, region, or address..."
                    class="w-full border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    v-if="searchQuery"
                    @click="searchQuery = ''"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    type="button"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Advanced filters -->
            <div class="flex items-center gap-2 mb-3 flex-wrap">
                <select
                    v-model="filterType"
                    class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                    <option value="">All Types</option>
                    <option value="fire">Fire</option>
                    <option value="medical">Medical</option>
                    <option value="welfare_check">Welfare Check</option>
                    <option value="missing_person">Missing Person</option>
                    <option value="hazmat">Hazmat</option>
                    <option value="rescue">Rescue</option>
                    <option value="other">Other</option>
                </select>
                <select
                    v-if="authStore.isAdmin"
                    v-model="filterAssignee"
                    class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                    <option value="">All Caseworkers</option>
                    <option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option>
                </select>
                <button
                    v-if="filterType || filterAssignee"
                    @click="filterType = ''; filterAssignee = ''"
                    class="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    Clear filters
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

            <template v-else>

                <!-- Map view -->
                <div v-if="activeTab === 'map'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span class="text-sm font-semibold text-slate-700">Active case locations</span>
                        <span class="text-xs text-slate-400">{{ mappableCases.length }} pinned</span>
                    </div>
                    <div v-if="mappableCases.length === 0" class="px-4 py-8 text-center text-slate-400 text-sm">
                        No active cases with location data.
                    </div>
                    <div v-else class="p-3">
                        <CasesMap :cases="mappableCases" @pin-click="router.push(`/cases/${$event}`)" />
                    </div>
                    <!-- Legend -->
                    <div class="px-4 py-3 border-t border-slate-100 flex items-center gap-4">
                        <span class="text-xs text-slate-400 font-medium">Priority:</span>
                        <span v-for="(color, label) in { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' }" :key="label" class="flex items-center gap-1 text-xs text-slate-600">
                            <span class="inline-block w-2.5 h-2.5 rounded-full" :style="{ background: color }"></span>
                            {{ label }}
                        </span>
                    </div>
                </div>

                <!-- Table view -->
                <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-3 w-8">
                                    <input
                                        type="checkbox"
                                        :checked="allSelected"
                                        :ref="(el) => { if (el) (el as HTMLInputElement).indeterminate = someSelected; }"
                                        @change="toggleSelectAll"
                                        class="rounded border-slate-300 text-blue-600 cursor-pointer"
                                    />
                                </th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Due</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Region</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Assigned To</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="displayedCases.length === 0">
                                <td colspan="8" class="px-4 py-8 text-center text-slate-400">
                                    {{ isSearching ? `No cases found matching "${searchQuery}".` : 'No cases found.' }}
                                </td>
                            </tr>
                            <tr
                                v-for="c in displayedCases"
                                :key="c._id"
                                class="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                                :class="selectedIds.has(c._id) ? 'bg-blue-50 hover:bg-blue-50' : ''"
                                @click="$router.push(`/cases/${c._id}`)"
                            >
                                <td class="px-4 py-3 w-8" @click.stop>
                                    <input
                                        type="checkbox"
                                        :checked="selectedIds.has(c._id)"
                                        @change="toggleSelect(c._id)"
                                        class="rounded border-slate-300 text-blue-600 cursor-pointer"
                                    />
                                </td>
                                <td class="px-4 py-3">
                                    <span class="font-medium text-slate-800">{{ c.title }}</span>
                                    <span
                                        v-if="dueBadge(c.dueAt)"
                                        class="block text-xs font-medium mt-0.5"
                                        :class="dueBadge(c.dueAt)!.cls"
                                    >{{ dueBadge(c.dueAt)!.label }}</span>
                                </td>
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
                                <td class="px-4 py-3 text-xs text-slate-500">
                                    {{ c.dueAt ? formatDate(c.dueAt) : '—' }}
                                </td>
                                <td class="px-4 py-3 text-slate-600">{{ c.region }}</td>
                                <td class="px-4 py-3 text-slate-600">{{ c.assignedTo?.name ?? '—' }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- Load more (closed tab only, not during search) -->
                    <div v-if="!isSearching && activeTab === 'closed' && casesStore.closedHasMore" class="px-4 py-3 border-t border-slate-100 text-center">
                        <button
                            @click="casesStore.loadMoreClosed()"
                            :disabled="casesStore.closedLoading"
                            class="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                        >
                            {{ casesStore.closedLoading ? 'Loading...' : 'Load more' }}
                        </button>
                    </div>
                </div>

            </template>
        </div>
    </div>

    <!-- Bulk action bar -->
    <Transition
        enter-active-class="transition ease-out duration-150"
        enter-from-class="opacity-0 translate-y-3"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-3"
    >
        <div
            v-if="selectedIds.size > 0"
            class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4 z-40 whitespace-nowrap"
        >
            <span class="text-sm font-medium">{{ selectedIds.size }} selected</span>
            <div class="w-px h-4 bg-slate-600 shrink-0"></div>
            <div class="flex items-center gap-2">
                <button
                    @click="bulkUpdateStatus('open')"
                    :disabled="bulkUpdating"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 transition-colors"
                >Open</button>
                <button
                    @click="bulkUpdateStatus('in_progress')"
                    :disabled="bulkUpdating"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >In Progress</button>
                <button
                    @click="bulkUpdateStatus('closed')"
                    :disabled="bulkUpdating"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-50 transition-colors"
                >Closed</button>
            </div>
            <div class="w-px h-4 bg-slate-600 shrink-0"></div>
            <button
                @click="selectedIds = new Set()"
                class="text-xs text-slate-400 hover:text-white transition-colors"
            >✕ Clear</button>
        </div>
    </Transition>

</template>
