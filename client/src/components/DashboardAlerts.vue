<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useAlertsStore } from '../stores/alerts';
import AlertsMap from './AlertsMap.vue';

const router = useRouter();
const authStore = useAuthStore();
const alertsStore = useAlertsStore();
</script>

<template>
    <div v-if="alertsStore.activeAlerts.length > 0" class="mb-6">
        <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-700">
                Active Alerts
                <span
                    class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="alertsStore.urgentAlerts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'"
                >
                    {{ alertsStore.activeAlerts.length }}
                </span>
            </h2>
            <button
                v-if="authStore.isAdmin"
                @click="router.push('/alerts/manage')"
                class="text-xs text-blue-600 hover:underline"
            >Manage alerts</button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Alert list -->
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                <div
                    v-for="a in alertsStore.activeAlerts.slice(0, 5)"
                    :key="a._id"
                    class="flex items-start gap-3 px-4 py-3"
                >
                    <span
                        class="mt-0.5 inline-block w-2 h-2 rounded-full shrink-0"
                        :class="{
                            'bg-red-500':    a.severity === 'critical',
                            'bg-orange-500': a.severity === 'high',
                            'bg-yellow-400': a.severity === 'medium',
                            'bg-blue-400':   a.severity === 'info',
                        }"
                    ></span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700 truncate">{{ a.message }}</p>
                        <p v-if="a.region" class="text-xs text-slate-400 mt-0.5">{{ a.region }}</p>
                    </div>
                    <span
                        class="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium"
                        :class="{
                            'bg-red-100 text-red-700':       a.severity === 'critical',
                            'bg-orange-100 text-orange-700': a.severity === 'high',
                            'bg-yellow-100 text-yellow-700': a.severity === 'medium',
                            'bg-blue-100 text-blue-700':     a.severity === 'info',
                        }"
                    >{{ a.severity }}</span>
                </div>
                <div v-if="alertsStore.activeAlerts.length > 5" class="px-4 py-2 text-xs text-slate-400 text-center">
                    +{{ alertsStore.activeAlerts.length - 5 }} more
                </div>
            </div>

            <!-- Alerts map -->
            <div
                v-if="alertsStore.activeAlerts.some(a => a.lat != null)"
                class="rounded-xl overflow-hidden border border-slate-200 shadow-sm"
            >
                <AlertsMap :alerts="alertsStore.activeAlerts" />
            </div>
            <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-center text-sm text-slate-400">
                No alerts have been pinned to a location yet.
            </div>
        </div>
    </div>
</template>
