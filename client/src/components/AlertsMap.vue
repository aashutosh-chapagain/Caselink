<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Alert } from '../api/alerts';

const props = defineProps<{
    alerts: Alert[];
}>();

const severityColor: Record<string, string> = {
    critical: '#ef4444',
    high:     '#f97316',
    medium:   '#eab308',
    info:     '#3b82f6',
};

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
const markerMap = new Map<string, L.CircleMarker>();

function alertsWithCoords() {
    return props.alerts.filter(a => a.isActive && a.lat != null && a.lng != null);
}

function addMarker(alert: Alert) {
    if (!map || alert.lat == null || alert.lng == null) return;
    const color = severityColor[alert.severity] ?? '#3b82f6';
    const m = L.circleMarker([alert.lat, alert.lng], {
        radius: 10,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 2,
    }).addTo(map);
    m.bindPopup(`
        <div style="min-width:160px">
            <p style="font-weight:600;margin-bottom:4px">${alert.severity.toUpperCase()}</p>
            <p style="font-size:13px">${alert.message}</p>
            ${alert.region ? `<p style="font-size:11px;color:#64748b;margin-top:4px">${alert.region}</p>` : ''}
        </div>
    `);
    markerMap.set(alert._id, m);
}

function syncMarkers() {
    if (!map) return;
    const live = alertsWithCoords();
    const liveIds = new Set(live.map(a => a._id));

    // remove markers for alerts no longer present/active
    for (const [id, m] of markerMap) {
        if (!liveIds.has(id)) {
            m.remove();
            markerMap.delete(id);
        }
    }

    // add new markers
    for (const alert of live) {
        if (!markerMap.has(alert._id)) {
            addMarker(alert);
        }
    }

    // fit bounds if any markers exist
    if (markerMap.size > 0) {
        const group = L.featureGroup(Array.from(markerMap.values()));
        map.fitBounds(group.getBounds().pad(0.3));
    }
}

onMounted(async () => {
    if (!mapEl.value) return;

    // default to Perth, WA if no alerts have coords
    map = L.map(mapEl.value).setView([-31.9505, 115.8605], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

    // Container may not have final dimensions yet when mounted inside a v-if.
    // invalidateSize() forces Leaflet to recalculate after the layout is settled.
    await nextTick();
    map.invalidateSize();
    syncMarkers();
});

watch(() => props.alerts, syncMarkers, { deep: true });

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <div ref="mapEl" class="w-full h-64 rounded-lg overflow-hidden z-0"></div>
</template>
