<script setup lang="ts">
import { computed } from 'vue';
import PinMap, { type MapPin } from './PinMap.vue';
import type { Alert } from '../api/alerts';

const props = defineProps<{ alerts: Alert[] }>();

const severityColor: Record<string, string> = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#eab308',
    info:     '#3b82f6',
};

const pins = computed<MapPin[]>(() =>
    props.alerts
        .filter(a => a.isActive && a.lat != null && a.lng != null)
        .map(a => ({
            id: a._id,
            lat: a.lat!,
            lng: a.lng!,
            color: severityColor[a.severity] ?? '#3b82f6',
            popup: `
                <div style="min-width:160px">
                    <p style="font-weight:600;margin-bottom:4px">${a.severity.toUpperCase()}</p>
                    <p style="font-size:13px">${a.message}</p>
                    ${a.region ? `<p style="font-size:11px;color:#64748b;margin-top:4px">${a.region}</p>` : ''}
                </div>
            `,
        }))
);
</script>

<template>
    <PinMap :pins="pins" />
</template>
