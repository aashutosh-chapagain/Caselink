<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useAlertsStore } from './stores/alerts';
import { destroySocket } from './api/socket';

const router = useRouter();
const authStore = useAuthStore();
const alertsStore = useAlertsStore();

const dismissed = ref<Set<string>>(new Set());

function visibleUrgent() {
    return alertsStore.urgentAlerts.filter(a => !dismissed.value.has(a._id));
}

function dismiss(id: string) {
    dismissed.value = new Set([...dismissed.value, id]);
}

watch(
    () => authStore.token,
    (newToken, oldToken) => {
        if (oldToken) {
            // previous session cleanup — covers logout AND account switch without logout
            alertsStore.reset();
            destroySocket();
        }
        if (newToken) {
            alertsStore.fetchAlerts();
            alertsStore.connectSocket();
        }
    },
    { immediate: true, flush: 'sync' },
);

onUnmounted(() => {
    destroySocket();
});

function logout() {
    authStore.logout();
    router.push('/');
}

const severityBannerStyles: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high:     'bg-orange-500 text-white',
};
</script>

<template>
    <div class="min-h-screen flex flex-col">
        <nav v-if="authStore.isAuthenticated" class="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div class="flex items-center gap-6">
                <span class="font-semibold text-slate-800 cursor-pointer" @click="router.push('/dashboard')">CaseLink</span>
                <div class="flex items-center gap-4 text-sm">
                    <button
                        @click="router.push('/dashboard')"
                        class="text-slate-500 hover:text-slate-800 transition-colors"
                        :class="$route.path === '/dashboard' ? 'text-blue-600 font-medium' : ''"
                    >
                        Dashboard
                    </button>
                    <button
                        @click="router.push('/cases')"
                        class="text-slate-500 hover:text-slate-800 transition-colors"
                        :class="$route.path.startsWith('/cases') ? 'text-blue-600 font-medium' : ''"
                    >
                        Cases
                    </button>
                    <button
                        v-if="authStore.isAdmin"
                        @click="router.push('/alerts/manage')"
                        class="text-slate-500 hover:text-slate-800 transition-colors"
                        :class="$route.path.startsWith('/alerts') ? 'text-blue-600 font-medium' : ''"
                    >
                        Alerts
                    </button>
                    <button
                        v-if="authStore.isAdmin"
                        @click="router.push('/team')"
                        class="text-slate-500 hover:text-slate-800 transition-colors"
                        :class="$route.path === '/team' ? 'text-blue-600 font-medium' : ''"
                    >
                        Team
                    </button>
                </div>
            </div>
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

        <!-- Urgent alert banners -->
        <template v-if="authStore.isAuthenticated">
            <div
                v-for="alert in visibleUrgent()"
                :key="alert._id"
                class="flex items-start gap-3 px-6 py-2.5 text-sm"
                :class="severityBannerStyles[alert.severity]"
            >
                <span class="font-semibold uppercase shrink-0 mt-px">{{ alert.severity }}</span>
                <span class="flex-1">{{ alert.message }}</span>
                <span v-if="alert.region" class="opacity-80 shrink-0">{{ alert.region }}</span>
                <button
                    @click="dismiss(alert._id)"
                    class="ml-2 shrink-0 opacity-70 hover:opacity-100 font-bold leading-none"
                    aria-label="Dismiss"
                >✕</button>
            </div>
        </template>

        <router-view />
    </div>
</template>
