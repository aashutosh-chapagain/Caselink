<script setup lang="ts">
import { computed } from 'vue';
import PinMap, { type MapPin } from './PinMap.vue';
import type { Case } from '../api/cases';

const props = defineProps<{ cases: Case[] }>();
const emit = defineEmits<{ 'pin-click': [id: string] }>();

const priorityColor: Record<string, string> = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#eab308',
    low:      '#22c55e',
};

const statusLabel: Record<string, string> = {
    open:        'Open',
    in_progress: 'In Progress',
    closed:      'Closed',
};

const pins = computed<MapPin[]>(() =>
    props.cases
        .filter(c => c.lat != null && c.lng != null)
        .map(c => ({
            id: c._id,
            lat: c.lat!,
            lng: c.lng!,
            color: priorityColor[c.priority] ?? '#94a3b8',
            popup: `
                <div style="min-width:160px">
                    <p style="font-weight:600;margin-bottom:4px">${c.title}</p>
                    <p style="font-size:12px;color:#64748b">${statusLabel[c.status] ?? c.status} · ${c.priority}</p>
                    ${c.region ? `<p style="font-size:11px;color:#64748b;margin-top:4px">${c.region}</p>` : ''}
                </div>
            `,
        }))
);
</script>

<template>
    <PinMap :pins="pins" height="h-[480px]" @pin-click="emit('pin-click', $event)" />
</template>
