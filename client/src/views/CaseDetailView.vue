<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCase, updateCase, getActivities, addActivity, getCases, linkCase, unlinkCase, type Case, type Activity, type CasePriority, type CaseType } from '../api/cases';
import { getUsers, type WorkspaceUser } from '../api/users';
import { useAuthStore } from '../stores/auth';
import { getSocket } from '../api/socket';
import CaseMap from '../components/CaseMap.vue';
import LocationPicker from '../components/LocationPicker.vue';
import { priorityStyles, priorityLabel, statusStyles, statusLabel, typeLabel, dueBadgeClass } from '../utils/caseStyles';
import { formatDate, formatDateTime } from '../utils/format';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const authStore = useAuthStore();

const caseData = ref<Case | null>(null);
const activities = ref<Activity[]>([]);
const activitiesHasMore = ref(false);
const activitiesLoading = ref(false);
const users = ref<WorkspaceUser[]>([]);
const loading = ref(true);
const error = ref('');
const statusUpdating = ref(false);
const reassigning = ref(false);
const noteText = ref('');
const noteSubmitting = ref(false);
const noteError = ref('');

const editing = ref(false);
const editTitle = ref('');
const editDescription = ref('');
const editPriority = ref<CasePriority>('medium');
const editType = ref<CaseType>('other');
const editAddress = ref('');
const editLat = ref(0);
const editLng = ref(0);
const editDueAt = ref('');
const editSaving = ref(false);
const editError = ref('');

function startEdit() {
    if (!caseData.value) return;
    editTitle.value = caseData.value.title;
    editDescription.value = caseData.value.description;
    editPriority.value = caseData.value.priority;
    editType.value = caseData.value.type;
    editAddress.value = caseData.value.address ?? '';
    editLat.value = caseData.value.lat ?? 0;
    editLng.value = caseData.value.lng ?? 0;
    editDueAt.value = caseData.value.dueAt ? caseData.value.dueAt.split('T')[0] : '';
    editError.value = '';
    editing.value = true;
}

function onEditAddressSelect(selected: { address: string; lat: number; lng: number }) {
    editAddress.value = selected.address;
    editLat.value = selected.lat;
    editLng.value = selected.lng;
}

function cancelEdit() {
    editing.value = false;
}

async function saveEdit() {
    if (!editTitle.value.trim()) {
        editError.value = 'Title cannot be empty';
        return;
    }
    editSaving.value = true;
    editError.value = '';
    try {
        const res = await updateCase(id, {
            title: editTitle.value.trim(),
            description: editDescription.value.trim(),
            priority: editPriority.value,
            type: editType.value,
            address: editAddress.value,
            ...(editAddress.value && { lat: editLat.value, lng: editLng.value }),
            dueAt: editDueAt.value || null,
        });
        caseData.value = res.data;
        editing.value = false;
    } catch (err: any) {
        editError.value = err.response?.data?.error || 'Failed to save changes';
    } finally {
        editSaving.value = false;
    }
}

const statusOptions: Case['status'][] = ['open', 'in_progress', 'closed'];

const activityTypeStyles: Record<string, string> = {
    note: 'bg-slate-100 text-slate-600',
    status_change: 'bg-blue-50 text-blue-600',
    assignment: 'bg-purple-50 text-purple-600',
    update: 'bg-amber-50 text-amber-600',
};

async function changeStatus(status: Case['status']) {
    if (!caseData.value || caseData.value.status === status) return;
    statusUpdating.value = true;
    try {
        const res = await updateCase(id, { status });
        caseData.value = res.data;
    } finally {
        statusUpdating.value = false;
    }
}

async function reassignCase(userId: string) {
    if (!caseData.value || caseData.value.assignedTo?._id === userId) return;
    reassigning.value = true;
    try {
        const res = await updateCase(id, { assignedTo: userId });
        caseData.value = res.data;
    } finally {
        reassigning.value = false;
    }
}

async function loadMoreActivities() {
    if (!activitiesHasMore.value || activities.value.length === 0) return;
    activitiesLoading.value = true;
    try {
        const cursor = activities.value[0]._id;
        const res = await getActivities(id, { limit: 20, before: cursor });
        activities.value = [...res.data.activities, ...activities.value];
        activitiesHasMore.value = res.data.hasMore;
    } finally {
        activitiesLoading.value = false;
    }
}

async function submitNote() {
    if (!noteText.value.trim()) return;
    noteSubmitting.value = true;
    noteError.value = '';
    try {
        await addActivity(id, noteText.value.trim());
        noteText.value = '';
    } catch (err: any) {
        noteError.value = err.response?.data?.error || 'Failed to add note';
    } finally {
        noteSubmitting.value = false;
    }
}

const socket = getSocket();

function onCaseUpdated(updated: Case) {
    if (updated._id === id) caseData.value = updated;
}
function onActivityAdded(activity: Activity) {
    if (activity.caseId === id) activities.value.push(activity);
}

onMounted(async () => {
    try {
        const [caseRes, activitiesRes, usersRes] = await Promise.all([
            getCase(id),
            getActivities(id),
            getUsers(),
        ]);
        caseData.value = caseRes.data;
        activities.value = activitiesRes.data.activities;
        activitiesHasMore.value = activitiesRes.data.hasMore;
        users.value = usersRes.data;
    } catch {
        error.value = 'Case not found or you do not have access.';
    } finally {
        loading.value = false;
    }

    socket.on('case:updated', onCaseUpdated);
    socket.on('activity:added', onActivityAdded);
});

onUnmounted(() => {
    socket.off('case:updated', onCaseUpdated);
    socket.off('activity:added', onActivityAdded);
    if (linkDebounce) clearTimeout(linkDebounce);
});

// --- Case linking ---
const linkSearch = ref('');
const linkResults = ref<Case[]>([]);
const linkSearchLoading = ref(false);
const linkDropdownOpen = ref(false);
const linking = ref(false);
const unlinking = ref<Set<string>>(new Set());
let linkDebounce: ReturnType<typeof setTimeout> | null = null;

const linkedCases = computed(() => caseData.value?.linkedCaseIds ?? []);
const linkedIds = computed(() => new Set(linkedCases.value.map(c => c._id)));

function onLinkInput() {
    if (linkDebounce) clearTimeout(linkDebounce);
    if (!linkSearch.value.trim()) {
        linkResults.value = [];
        linkDropdownOpen.value = false;
        return;
    }
    linkDebounce = setTimeout(async () => {
        linkSearchLoading.value = true;
        try {
            const res = await getCases({ search: linkSearch.value.trim() });
            linkResults.value = res.data.cases.filter(
                c => c._id !== id && !linkedIds.value.has(c._id)
            );
            linkDropdownOpen.value = true;
        } catch {
            linkResults.value = [];
        } finally {
            linkSearchLoading.value = false;
        }
    }, 300);
}

async function addLink(targetId: string) {
    linking.value = true;
    linkSearch.value = '';
    linkResults.value = [];
    linkDropdownOpen.value = false;
    try {
        const res = await linkCase(id, targetId);
        caseData.value = res.data;
    } catch {
        // silently ignore — server returns 400 if already linked
    } finally {
        linking.value = false;
    }
}

function onLinkBlur() {
    setTimeout(() => { linkDropdownOpen.value = false; }, 150);
}

// --- Case history / SLA ---

function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

const statusHistory = computed(() => {
    if (!caseData.value) return [];

    const changes = [...activities.value]
        .filter(a => a.type === 'status_change')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const result: Array<{ status: string; from: Date; to: Date | null; durationMs: number | null }> = [];
    let currentStatus = 'open';
    let currentFrom = new Date(caseData.value.createdAt);

    for (const change of changes) {
        const match = change.note.match(/Status changed from (.+) to (.+)/);
        if (!match) continue;
        const changeTime = new Date(change.createdAt);
        result.push({ status: currentStatus, from: currentFrom, to: changeTime, durationMs: changeTime.getTime() - currentFrom.getTime() });
        currentStatus = match[2];
        currentFrom = changeTime;
    }

    const isFinished = caseData.value.status === 'closed';
    result.push({
        status: currentStatus,
        from: currentFrom,
        to: isFinished ? new Date(caseData.value.updatedAt) : null,
        durationMs: isFinished ? new Date(caseData.value.updatedAt).getTime() - currentFrom.getTime() : null,
    });

    return result;
});

const slaStatus = computed(() => {
    if (!caseData.value?.dueAt) return null;
    const dueAt = new Date(caseData.value.dueAt);
    if (caseData.value.status === 'closed') {
        return new Date(caseData.value.updatedAt) <= dueAt ? 'met' : 'missed';
    }
    return new Date() <= dueAt ? 'on_track' : 'overdue';
});

async function removeLink(linkedId: string) {
    const next = new Set(unlinking.value);
    next.add(linkedId);
    unlinking.value = next;
    try {
        const res = await unlinkCase(id, linkedId);
        caseData.value = res.data;
    } finally {
        const s = new Set(unlinking.value);
        s.delete(linkedId);
        unlinking.value = s;
    }
}
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-4xl mx-auto px-6 py-8">

            <!-- Back -->
            <button @click="router.push('/cases')" class="text-sm text-slate-500 hover:text-slate-700 mb-6 flex items-center gap-1">
                ← Back to Cases
            </button>

            <!-- Loading -->
            <div v-if="loading" class="text-slate-500 text-sm">Loading case...</div>

            <!-- Error -->
            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ error }}
            </div>

            <template v-else-if="caseData">
                <!-- Case header -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <!-- View mode -->
                    <template v-if="!editing">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex items-start gap-2 min-w-0">
                                <h1 class="text-xl font-bold text-slate-800">{{ caseData.title }}</h1>
                                <button
                                    @click="startEdit"
                                    title="Edit title and description"
                                    class="mt-1 shrink-0 p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <span
                                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="priorityStyles[caseData.priority]"
                                >
                                    {{ priorityLabel[caseData.priority] }}
                                </span>
                                <span
                                    class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="statusStyles[caseData.status]"
                                >
                                    {{ statusLabel[caseData.status] }}
                                </span>
                            </div>
                        </div>
                        <p class="mt-3 text-sm text-slate-600">{{ caseData.description }}</p>
                    </template>

                    <!-- Edit mode -->
                    <template v-else>
                        <div class="space-y-3">
                            <div>
                                <input
                                    v-model="editTitle"
                                    type="text"
                                    class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="Case title"
                                />
                            </div>
                            <div>
                                <textarea
                                    v-model="editDescription"
                                    rows="3"
                                    class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    placeholder="Description"
                                />
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                                    <select
                                        v-model="editPriority"
                                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    >
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                    <select
                                        v-model="editType"
                                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    >
                                        <option value="fire">Fire</option>
                                        <option value="medical">Medical</option>
                                        <option value="welfare_check">Welfare Check</option>
                                        <option value="missing_person">Missing Person</option>
                                        <option value="hazmat">Hazmat</option>
                                        <option value="rescue">Rescue</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-500 mb-1">
                                    Due Date <span class="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    v-model="editDueAt"
                                    type="date"
                                    class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-slate-500 mb-1">
                                    Address <span class="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <LocationPicker
                                    :initialAddress="editAddress"
                                    :initialLat="editLat || undefined"
                                    :initialLng="editLng || undefined"
                                    @select="onEditAddressSelect"
                                />
                            </div>
                            <p v-if="editError" class="text-red-600 text-xs">{{ editError }}</p>
                            <div class="flex gap-2">
                                <button
                                    @click="saveEdit"
                                    :disabled="editSaving"
                                    class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {{ editSaving ? 'Saving…' : 'Save' }}
                                </button>
                                <button
                                    @click="cancelEdit"
                                    :disabled="editSaving"
                                    class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </template>

                    <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span class="text-slate-400">Type</span>
                            <p class="text-slate-700 font-medium">{{ typeLabel[caseData.type] ?? caseData.type }}</p>
                        </div>
                        <div>
                            <span class="text-slate-400">Priority</span>
                            <p class="text-slate-700 font-medium">{{ priorityLabel[caseData.priority] }}</p>
                        </div>
                        <div>
                            <span class="text-slate-400">Region</span>
                            <p class="text-slate-700 font-medium">{{ caseData.region }}</p>
                        </div>
                        <div>
                            <span class="text-slate-400">Assigned To</span>
                            <p class="text-slate-700 font-medium">{{ caseData.assignedTo?.name ?? '—' }}</p>
                            <select
                                v-if="authStore.isAdmin"
                                :value="caseData.assignedTo?._id"
                                :disabled="reassigning"
                                @change="reassignCase(($event.target as HTMLSelectElement).value)"
                                class="mt-1 w-full border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-600 disabled:opacity-50"
                            >
                                <option v-for="u in users" :key="u._id" :value="u._id">
                                    {{ u.name }} ({{ u.role }})
                                </option>
                            </select>
                        </div>
                        <div>
                            <span class="text-slate-400">Created By</span>
                            <p class="text-slate-700 font-medium">{{ caseData.createdBy?.name ?? '—' }}</p>
                        </div>
                        <div>
                            <span class="text-slate-400">Created</span>
                            <p class="text-slate-700 font-medium">{{ formatDate(caseData.createdAt) }}</p>
                        </div>
                        <div>
                            <span class="text-slate-400">Due Date</span>
                            <p v-if="caseData.dueAt" class="font-medium mt-0.5" :class="dueBadgeClass(caseData.dueAt)">
                                {{ formatDate(caseData.dueAt) }}
                                <span v-if="new Date(caseData.dueAt) < new Date()" class="ml-1 text-xs">(Overdue)</span>
                            </p>
                            <p v-else class="text-slate-400 text-sm">—</p>
                        </div>
                        <div v-if="caseData.address" class="col-span-2">
                            <span class="text-slate-400">Address</span>
                            <p class="text-slate-700 font-medium mb-3">{{ caseData.address }}</p>
                            <CaseMap
                                v-if="caseData.lat && caseData.lng"
                                :lat="caseData.lat"
                                :lng="caseData.lng"
                                :label="caseData.address"
                            />
                        </div>
                    </div>

                    <!-- Status change -->
                    <div class="mt-5 pt-5 border-t border-slate-100">
                        <p class="text-xs font-medium text-slate-400 mb-2">Change Status</p>
                        <div class="flex gap-2">
                            <button
                                v-for="s in statusOptions"
                                :key="s"
                                @click="changeStatus(s)"
                                :disabled="statusUpdating || caseData.status === s"
                                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40"
                                :class="caseData.status === s
                                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
                            >
                                {{ statusLabel[s] }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Related cases -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 class="text-sm font-semibold text-slate-700 mb-4">Related Cases</h2>

                    <!-- Linked list -->
                    <ul v-if="linkedCases.length > 0" class="divide-y divide-slate-100 mb-4">
                        <li
                            v-for="lc in linkedCases"
                            :key="lc._id"
                            class="flex items-center gap-3 py-2.5"
                        >
                            <button
                                @click="router.push(`/cases/${lc._id}`)"
                                class="flex-1 min-w-0 text-left"
                            >
                                <span class="block text-sm font-medium text-slate-800 truncate">{{ lc.title }}</span>
                                <span class="text-xs text-slate-400">{{ lc.region }}</span>
                            </button>
                            <span
                                class="shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="priorityStyles[lc.priority]"
                            >{{ priorityLabel[lc.priority] }}</span>
                            <span
                                class="shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="statusStyles[lc.status]"
                            >{{ statusLabel[lc.status] }}</span>
                            <button
                                @click="removeLink(lc._id)"
                                :disabled="unlinking.has(lc._id)"
                                class="shrink-0 p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                                title="Remove link"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </li>
                    </ul>
                    <p v-else class="text-sm text-slate-400 mb-4">No related cases linked yet.</p>

                    <!-- Search to add link -->
                    <div class="relative">
                        <input
                            v-model="linkSearch"
                            @input="onLinkInput"
                            @blur="onLinkBlur"
                            type="text"
                            placeholder="Search cases to link…"
                            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <div
                            v-if="linkDropdownOpen && linkResults.length > 0"
                            class="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                        >
                            <button
                                v-for="r in linkResults.slice(0, 6)"
                                :key="r._id"
                                @mousedown.prevent="addLink(r._id)"
                                class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                            >
                                <div class="flex-1 min-w-0">
                                    <span class="block text-sm text-slate-800 truncate">{{ r.title }}</span>
                                    <span class="text-xs text-slate-400">{{ r.region }}</span>
                                </div>
                                <span class="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" :class="priorityStyles[r.priority]">
                                    {{ priorityLabel[r.priority] }}
                                </span>
                            </button>
                        </div>
                        <div
                            v-else-if="linkDropdownOpen && !linkSearchLoading && linkResults.length === 0"
                            class="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400"
                        >
                            No cases found.
                        </div>
                    </div>
                </div>

                <!-- Case history / SLA -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-sm font-semibold text-slate-700">Case History</h2>
                        <span
                            v-if="slaStatus"
                            class="text-xs font-medium px-2 py-0.5 rounded-full"
                            :class="{
                                'bg-green-100 text-green-700': slaStatus === 'met' || slaStatus === 'on_track',
                                'bg-red-100 text-red-700': slaStatus === 'missed' || slaStatus === 'overdue',
                            }"
                        >
                            SLA {{ slaStatus === 'met' ? 'Met' : slaStatus === 'missed' ? 'Missed' : slaStatus === 'on_track' ? 'On Track' : 'Overdue' }}
                        </span>
                    </div>
                    <p v-if="activitiesHasMore" class="text-xs text-slate-400 mb-3">
                        Showing history based on loaded activities — load older activity for full timeline.
                    </p>
                    <ol class="relative border-l border-slate-200 space-y-4 ml-2">
                        <li
                            v-for="(seg, i) in statusHistory"
                            :key="i"
                            class="pl-5"
                        >
                            <div class="absolute w-2.5 h-2.5 rounded-full -left-1.5 mt-0.5"
                                :class="{
                                    'bg-blue-400': seg.status === 'open',
                                    'bg-amber-400': seg.status === 'in_progress',
                                    'bg-slate-400': seg.status === 'closed',
                                }"
                            ></div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-medium text-slate-700 capitalize">
                                    {{ seg.status === 'in_progress' ? 'In Progress' : seg.status === 'open' ? 'Open' : 'Closed' }}
                                </span>
                                <span v-if="seg.durationMs !== null" class="text-xs text-slate-400">
                                    {{ formatDuration(seg.durationMs) }}
                                </span>
                                <span v-else class="text-xs text-slate-400 italic">ongoing</span>
                            </div>
                            <p class="text-xs text-slate-400 mt-0.5">
                                {{ seg.from.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                                <template v-if="seg.to">
                                    → {{ seg.to.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                                </template>
                            </p>
                        </li>
                    </ol>
                </div>

                <!-- Activity timeline -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 class="text-sm font-semibold text-slate-700 mb-4">Activity</h2>

                    <div v-if="activitiesHasMore" class="mb-4 text-center">
                        <button
                            @click="loadMoreActivities"
                            :disabled="activitiesLoading"
                            class="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                        >
                            {{ activitiesLoading ? 'Loading...' : 'Load older activity' }}
                        </button>
                    </div>

                    <div v-if="activities.length === 0" class="text-sm text-slate-400">No activity yet.</div>

                    <ul class="space-y-4">
                        <li v-for="a in activities" :key="a._id" class="flex gap-3">
                            <div class="mt-0.5 w-2 h-2 rounded-full bg-slate-300 shrink-0 mt-1.5"></div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-0.5">
                                    <span class="text-xs font-medium text-slate-700">{{ a.authorId?.name ?? 'System' }}</span>
                                    <span
                                        class="text-xs px-1.5 py-0.5 rounded font-medium"
                                        :class="activityTypeStyles[a.type]"
                                    >
                                        {{ a.type === 'status_change' ? 'Status' : a.type === 'assignment' ? 'Assignment' : a.type === 'update' ? 'Updated' : 'Note' }}
                                    </span>
                                    <span class="text-xs text-slate-400">{{ formatDateTime(a.createdAt) }}</span>
                                </div>
                                <p class="text-sm text-slate-600">{{ a.note }}</p>
                            </div>
                        </li>
                    </ul>

                    <!-- Add note -->
                    <form @submit.prevent="submitNote" class="mt-6 pt-5 border-t border-slate-100">
                        <textarea
                            v-model="noteText"
                            rows="3"
                            placeholder="Add a note..."
                            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                        <p v-if="noteError" class="text-red-600 text-xs mt-1">{{ noteError }}</p>
                        <div class="flex justify-end mt-2">
                            <button
                                type="submit"
                                :disabled="noteSubmitting || !noteText.trim()"
                                class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {{ noteSubmitting ? 'Adding...' : 'Add Note' }}
                            </button>
                        </div>
                    </form>
                </div>
            </template>

        </div>
    </div>
</template>
