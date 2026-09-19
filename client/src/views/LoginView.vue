<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import publicClient from '../api/publicClient';
import PasswordInput from '../components/PasswordInput.vue';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const router = useRouter();
const authStore = useAuthStore();

async function handleLogin() {
    error.value = '';
    loading.value = true;

    try {
        const res = await publicClient.post('/auth/login', {
            email: email.value,
            password: password.value,
        });
        console.log('Login successful:', res.data);
        authStore.setAuth(res.data.token, res.data.user);   
        router.push('/dashboard');

    } catch (err: any) {
        error.value = err.response?.data?.error || 'Login failed';
        console.log('Login error:', err);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex items-center justify-center bg-slate-100 min-h-screen">
        <form @submit.prevent="handleLogin" class="bg-white p-8 rounded-xl shadow-md w-80 space-y-4">
            <h1 class="text-2xl font-bold text-slate-800">CaseLink</h1>
            <div>
                <label class="block text-sm font-medium text-slate-600 mb-1">Email</label>
                <input 
                      v-model="email"
                      type="email"
                      required
                      class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                      />
            </div>
            <div>
                <label class="block text-sm font-medium text-slate-600 mb-1">Password</label>
                <PasswordInput v-model="password" required />
            </div>
            <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

            <button
                type="submit"
                :disabled="loading"
                class="w-full bg-blue-600 text-white rounded-md py-2 mt-4 text-sm font-medium disabled:opacity-50"
                >
                {{loading ? 'Logging in...' : 'Login'}}
            </button>

        </form>

        <p class="text-sm text-center text-slate-500 mt-4 px-4">
            New organisation?
            <router-link to="/register" class="text-blue-600 hover:underline">Create a workspace</router-link>
        </p>
    </div>
</template>
