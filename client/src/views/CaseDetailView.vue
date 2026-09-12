<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCase, updateCase, getActivities, addActivity, type Case, type Activity, type CasePriority } from '../api/cases';
import { getUsers, type WorkspaceUser } from '../api/users';
import { useAuthStore } from '../stores/auth';
import { createSocket } from '../api/socket';

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

const statusOptions: Case['status'][] = ['open', 'in_progress', 'closed'];

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

const activityTypeStyles: Record<string, string> = {
    note: 'bg-slate-100 text-slate-600',
    status_change: 'bg-blue-50 text-blue-600',
    assignment: 'bg-purple-50 text-purple-600',
};

const priorityStyles: Record<CasePriority, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
};

const priorityLabel: Record<CasePriority, string> = {
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
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

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

const socket = createSocket();

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

    socket.on('case:updated', (updated: Case) => {
        if (updated._id === id) caseData.value = updated;
    });

    socket.on('activity:added', (activity: Activity) => {
        if (activity.caseId === id) activities.value.push(activity);
    });
});

onUnmounted(() => {
    socket.disconnect();
});
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
                    <div class="flex items-start justify-between gap-4">
                        <h1 class="text-xl font-bold text-slate-800">{{ caseData.title }}</h1>
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
                        <div v-if="caseData.address" class="col-span-2">
                            <span class="text-slate-400">Address</span>
                            <p class="text-slate-700 font-medium">{{ caseData.address }}</p>
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
                                        {{ a.type === 'status_change' ? 'Status' : a.type === 'assignment' ? 'Assignment' : 'Note' }}
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
