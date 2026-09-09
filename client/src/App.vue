<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const router = useRouter();
const authStore = useAuthStore();

function logout() {
    authStore.logout();
    router.push('/');
}
</script>

<template>
    <div class="min-h-screen flex flex-col">
        <nav v-if="authStore.isAuthenticated" class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <span class="font-semibold text-slate-800 cursor-pointer" @click="router.push('/cases')">CaseLink</span>
            <div class="flex items-center gap-4">
                <span class="text-sm text-slate-500">
                    {{ authStore.user?.name }}
                    <span class="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{{ authStore.user?.role }}</span>
                </span>
                <button
                    @click="logout"
                    class="text-sm text-slate-500 hover:text-red-600 transition-colors"
                >
                    Logout
                </button>
            </div>
        </nav>
        <router-view />
    </div>
</template>
