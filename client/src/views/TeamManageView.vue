<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getUsers, type WorkspaceUser } from '../api/users';
import { getInvites, createInvite, revokeInvite, type Invite } from '../api/invites';

const members = ref<WorkspaceUser[]>([]);
const invites = ref<Invite[]>([]);
const loading = ref(true);
const error = ref('');

async function loadData() {
    try {
        const [usersRes, invitesRes] = await Promise.all([getUsers(), getInvites()]);
        members.value = usersRes.data;
        invites.value = invitesRes.data;
    } catch {
        error.value = 'Failed to load team data.';
    } finally {
        loading.value = false;
    }
}

onMounted(loadData);

// Invite modal
const showModal = ref(false);
const inviteEmail = ref('');
const inviteError = ref('');
const inviting = ref(false);
const generatedLink = ref('');

function openModal() {
    inviteEmail.value = '';
    inviteError.value = '';
    generatedLink.value = '';
    showModal.value = true;
}

async function submitInvite() {
    if (!inviteEmail.value.trim()) {
        inviteError.value = 'Email is required';
        return;
    }
    inviting.value = true;
    inviteError.value = '';
    try {
        const res = await createInvite(inviteEmail.value.trim());
        generatedLink.value = res.data.inviteUrl;
        await loadData();
    } catch (err: any) {
        inviteError.value = err.response?.data?.error || 'Failed to create invite';
    } finally {
        inviting.value = false;
    }
}

const copied = ref(false);
async function copyLink() {
    await navigator.clipboard.writeText(generatedLink.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
}

const revoking = ref<Set<string>>(new Set());
async function handleRevoke(id: string) {
    if (revoking.value.has(id)) return;
    revoking.value.add(id);
    try {
        await revokeInvite(id);
        invites.value = invites.value.filter(i => i._id !== id);
    } finally {
        revoking.value.delete(id);
    }
}

function formatExpiry(iso: string) {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const roleStyles: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    caseworker: 'bg-blue-100 text-blue-700',
};
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-4xl mx-auto px-6 py-8 space-y-8">

            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Team</h1>
                    <p class="text-sm text-slate-500 mt-0.5">Manage workspace members and invites</p>
                </div>
                <button
                    @click="openModal"
                    class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Invite caseworker
                </button>
            </div>

            <div v-if="loading" class="text-sm text-slate-500">Loading...</div>
            <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ error }}</div>

            <template v-else>

                <!-- Members table -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100">
                        <h2 class="text-sm font-semibold text-slate-700">Members ({{ members.length }})</h2>
                    </div>
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="m in members" :key="m._id" class="border-b border-slate-100 last:border-0">
                                <td class="px-4 py-3 font-medium text-slate-800">{{ m.name }}</td>
                                <td class="px-4 py-3 text-slate-600">{{ m.email }}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium" :class="roleStyles[m.role]">
                                        {{ m.role }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pending invites -->
                <div v-if="invites.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-4 py-3 border-b border-slate-100">
                        <h2 class="text-sm font-semibold text-slate-700">Pending invites ({{ invites.length }})</h2>
                    </div>
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Invited by</th>
                                <th class="text-left px-4 py-3 font-medium text-slate-600">Expires</th>
                                <th class="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="inv in invites" :key="inv._id" class="border-b border-slate-100 last:border-0">
                                <td class="px-4 py-3 text-slate-800">{{ inv.email }}</td>
                                <td class="px-4 py-3 text-slate-500">{{ inv.createdBy?.name ?? '—' }}</td>
                                <td class="px-4 py-3 text-slate-500">{{ formatExpiry(inv.expiresAt) }}</td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        @click="handleRevoke(inv._id)"
                                        :disabled="revoking.has(inv._id)"
                                        class="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-40"
                                    >
                                        Revoke
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </template>
        </div>
    </div>

    <!-- Invite modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showModal = false">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 class="text-lg font-semibold text-slate-800">Invite caseworker</h2>

            <template v-if="!generatedLink">
                <form @submit.prevent="submitInvite" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Email address</label>
                        <input
                            v-model="inviteEmail"
                            type="email"
                            required
                            placeholder="caseworker@example.com"
                            class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                        />
                    </div>
                    <p v-if="inviteError" class="text-red-600 text-sm">{{ inviteError }}</p>
                    <div class="flex justify-end gap-2">
                        <button type="button" @click="showModal = false" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                        <button
                            type="submit"
                            :disabled="inviting"
                            class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {{ inviting ? 'Generating...' : 'Generate invite link' }}
                        </button>
                    </div>
                </form>
            </template>

            <template v-else>
                <p class="text-sm text-slate-600">Share this link with the caseworker. It expires in 7 days.</p>
                <div class="flex items-center gap-2">
                    <input
                        :value="generatedLink"
                        readonly
                        class="flex-1 border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-600 bg-slate-50 truncate"
                    />
                    <button
                        @click="copyLink"
                        class="text-sm font-medium px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-800 transition-colors whitespace-nowrap"
                    >
                        {{ copied ? 'Copied!' : 'Copy' }}
                    </button>
                </div>
                <div class="flex justify-end">
                    <button @click="showModal = false" class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700">Done</button>
                </div>
            </template>
        </div>
    </div>
</template>
