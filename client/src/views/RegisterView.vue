<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import publicClient from '../api/publicClient';
import PasswordInput from '../components/PasswordInput.vue';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({ name: '', email: '', password: '', workspaceName: '' });
const error = ref('');
const loading = ref(false);

async function handleRegister() {
    error.value = '';
    loading.value = true;
    try {
        const res = await publicClient.post('/auth/register', {
            name: form.value.name,
            email: form.value.email,
            password: form.value.password,
            workspaceName: form.value.workspaceName,
        });
        authStore.setAuth(res.data.token, res.data.user);
        router.push('/dashboard');
    } catch (err: any) {
        error.value = err.response?.data?.error || 'Registration failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex items-center justify-center bg-slate-100 min-h-screen px-4">
        <div class="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-5">
            <div>
                <h1 class="text-2xl font-bold text-slate-800">Create your workspace</h1>
                <p class="text-sm text-slate-500 mt-1">You'll be the admin for this workspace.</p>
            </div>

            <form @submit.prevent="handleRegister" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Workspace name</label>
                    <input
                        v-model="form.workspaceName"
                        type="text"
                        required
                        placeholder="e.g. DFES Perth Metro"
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Your name</label>
                    <input
                        v-model="form.name"
                        type="text"
                        required
                        placeholder="Full name"
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Email</label>
                    <input
                        v-model="form.email"
                        type="email"
                        required
                        class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-600 mb-1">Password</label>
                    <PasswordInput v-model="form.password" placeholder="At least 8 characters" :minlength="8" required />
                </div>

                <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

                <button
                    type="submit"
                    :disabled="loading"
                    class="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {{ loading ? 'Creating workspace...' : 'Create workspace' }}
                </button>
            </form>

            <p class="text-sm text-center text-slate-500">
                Already have an account?
                <router-link to="/" class="text-blue-600 hover:underline">Sign in</router-link>
            </p>
        </div>
    </div>
</template>
