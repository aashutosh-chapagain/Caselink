<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useAlertsStore } from './stores/alerts';
import { useNotificationsStore } from './stores/notifications';
import { destroySocket } from './api/socket';

const router = useRouter();
const authStore = useAuthStore();
const alertsStore = useAlertsStore();
const notificationsStore = useNotificationsStore();

const dismissed = ref<Set<string>>(new Set());
const showNotifications = ref(false);

function openNotifications() {
    showNotifications.value = !showNotifications.value;
    if (showNotifications.value && notificationsStore.unreadCount > 0) {
        notificationsStore.markAllRead();
    }
}

function handleNotificationClick(caseId: string) {
    showNotifications.value = false;
    router.push(`/cases/${caseId}`);
}

function closeNotificationsOnOutsideClick() {
    showNotifications.value = false;
}

function timeAgo(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

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
            notificationsStore.reset();
            destroySocket();
        }
        if (newToken) {
            alertsStore.fetchAlerts();
            alertsStore.connectSocket();
            notificationsStore.fetch();
            notificationsStore.connectSocket();
        }
    },
    { immediate: true, flush: 'sync' },
);

onMounted(() => {
    document.addEventListener('click', closeNotificationsOnOutsideClick);
});

onUnmounted(() => {
    destroySocket();
    document.removeEventListener('click', closeNotificationsOnOutsideClick);
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
                <!-- Notification bell -->
                <div class="relative" @click.stop>
                    <button
                        @click="openNotifications"
                        class="relative text-slate-500 hover:text-slate-800 transition-colors p-1"
                        aria-label="Notifications"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span
                            v-if="notificationsStore.unreadCount > 0"
                            class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                        >
                            {{ notificationsStore.unreadCount > 9 ? '9+' : notificationsStore.unreadCount }}
                        </span>
                    </button>

                    <!-- Dropdown -->
                    <div
                        v-if="showNotifications"
                        class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden"
                    >
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span class="text-sm font-semibold text-slate-700">Notifications</span>
                        </div>
                        <div v-if="notificationsStore.notifications.length === 0" class="px-4 py-6 text-center text-sm text-slate-400">
                            No notifications yet.
                        </div>
                        <div v-else class="max-h-80 overflow-y-auto divide-y divide-slate-100">
                            <button
                                v-for="n in notificationsStore.notifications"
                                :key="n._id"
                                @click="handleNotificationClick(n.caseId)"
                                class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3"
                                :class="n.read ? 'opacity-60' : ''"
                            >
                                <span
                                    class="mt-1.5 w-2 h-2 rounded-full shrink-0"
                                    :class="n.read ? 'bg-slate-300' : 'bg-blue-500'"
                                ></span>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-slate-700 leading-snug">{{ n.message }}</p>
                                    <p class="text-xs text-slate-400 mt-0.5">{{ timeAgo(n.createdAt) }}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    @click="router.push('/profile')"
                    class="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    :class="$route.path === '/profile' ? 'text-blue-600 font-medium' : ''"
                >
                    {{ authStore.user?.name }}
                    <span class="ml-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{{ authStore.user?.role }}</span>
                </button>
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
