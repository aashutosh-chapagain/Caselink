<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getMyProfile, updateMyProfile, changePassword, type MyProfile } from '../api/users';
import { useAuthStore } from '../stores/auth';
import PasswordInput from '../components/PasswordInput.vue';

const authStore = useAuthStore();

const profile = ref<MyProfile | null>(null);
const loadError = ref('');

onMounted(async () => {
    try {
        const res = await getMyProfile();
        profile.value = res.data;
    } catch {
        loadError.value = 'Failed to load profile.';
    }
});

// Name editing
const editingName = ref(false);
const nameInput = ref('');
const savingName = ref(false);
const nameError = ref('');

function startEditName() {
    nameInput.value = profile.value?.name ?? '';
    nameError.value = '';
    editingName.value = true;
}

function cancelEditName() {
    editingName.value = false;
}

async function saveName() {
    if (!nameInput.value.trim()) {
        nameError.value = 'Name cannot be empty';
        return;
    }
    savingName.value = true;
    nameError.value = '';
    try {
        await updateMyProfile(nameInput.value.trim());
        profile.value!.name = nameInput.value.trim();
        authStore.updateUser({ name: nameInput.value.trim() });
        editingName.value = false;
    } catch (err: any) {
        nameError.value = err.response?.data?.error || 'Failed to update name';
    } finally {
        savingName.value = false;
    }
}

const form = ref({ currentPassword: '', newPassword: '' });
const submitting = ref(false);
const formError = ref('');
const success = ref(false);

async function handleChangePassword() {
    formError.value = '';
    success.value = false;
    submitting.value = true;
    try {
        await changePassword(form.value.currentPassword, form.value.newPassword);
        success.value = true;
        form.value = { currentPassword: '', newPassword: '' };
    } catch (err: any) {
        formError.value = err.response?.data?.error || 'Failed to update password';
    } finally {
        submitting.value = false;
    }
}

const roleStyles: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    caseworker: 'bg-blue-100 text-blue-700',
};
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-xl mx-auto px-6 py-8 space-y-6">

            <h1 class="text-2xl font-bold text-slate-800">Profile</h1>

            <div v-if="loadError" class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {{ loadError }}
            </div>

            <template v-else-if="profile">

                <!-- User info card -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 class="text-sm font-semibold text-slate-700">Account details</h2>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-slate-400 text-xs mb-0.5">Name</p>
                            <div v-if="editingName" class="flex flex-col gap-1.5">
                                <input
                                    v-model="nameInput"
                                    type="text"
                                    required
                                    class="w-full border border-slate-300 rounded-md px-2 py-1 text-sm"
                                    @keyup.enter="saveName"
                                    @keyup.esc="cancelEditName"
                                />
                                <div class="flex items-center gap-2">
                                    <button @click="saveName" :disabled="savingName" class="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                                        {{ savingName ? 'Saving…' : 'Save' }}
                                    </button>
                                    <button @click="cancelEditName" class="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                                </div>
                                <p v-if="nameError" class="text-red-600 text-xs">{{ nameError }}</p>
                            </div>
                            <div v-else class="flex items-center gap-2">
                                <p class="text-slate-800 font-medium">{{ profile.name }}</p>
                                <button @click="startEditName" class="text-xs text-slate-400 hover:text-slate-600">Edit</button>
                            </div>
                        </div>
                        <div>
                            <p class="text-slate-400 text-xs mb-0.5">Email</p>
                            <p class="text-slate-800">{{ profile.email }}</p>
                        </div>
                        <div>
                            <p class="text-slate-400 text-xs mb-0.5">Role</p>
                            <span
                                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="roleStyles[profile.role]"
                            >
                                {{ profile.role }}
                            </span>
                        </div>
                        <div>
                            <p class="text-slate-400 text-xs mb-0.5">Workspace</p>
                            <p class="text-slate-800">{{ profile.workspaceName }}</p>
                        </div>
                    </div>
                </div>

                <!-- Change password card -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 class="text-sm font-semibold text-slate-700 mb-4">Change password</h2>
                    <form @submit.prevent="handleChangePassword" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">Current password</label>
                            <PasswordInput v-model="form.currentPassword" required />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">New password</label>
                            <PasswordInput v-model="form.newPassword" placeholder="At least 8 characters" :minlength="8" required />
                        </div>

                        <p v-if="formError" class="text-red-600 text-sm">{{ formError }}</p>
                        <p v-if="success" class="text-green-600 text-sm">Password updated successfully.</p>

                        <div class="flex justify-end">
                            <button
                                type="submit"
                                :disabled="submitting"
                                class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {{ submitting ? 'Updating...' : 'Update password' }}
                            </button>
                        </div>
                    </form>
                </div>

            </template>

        </div>
    </div>
</template>
