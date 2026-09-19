<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPin {
    id: string;
    lat: number;
    lng: number;
    color: string;
    popup: string;
}

const props = withDefaults(defineProps<{
    pins: MapPin[];
    height?: string;
}>(), {
    height: 'h-64',
});

const emit = defineEmits<{ 'pin-click': [id: string] }>();

const DEFAULT_CENTER: L.LatLngExpression = [-31.9505, 115.8605]; // Perth, WA
const DEFAULT_ZOOM = 10;

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
const markerMap = new Map<string, L.CircleMarker>();

function addMarker(pin: MapPin) {
    if (!map) return;
    const m = L.circleMarker([pin.lat, pin.lng], {
        radius: 10,
        color: pin.color,
        fillColor: pin.color,
        fillOpacity: 0.75,
        weight: 2,
    }).addTo(map);
    m.bindPopup(pin.popup, { autoPan: false });
    m.on('mouseover', () => m.openPopup());
    m.on('mouseout', () => m.closePopup());
    m.on('click', () => emit('pin-click', pin.id));
    markerMap.set(pin.id, m);
}

function syncMarkers() {
    if (!map) return;
    const liveIds = new Set(props.pins.map(p => p.id));

    for (const [id, m] of markerMap) {
        if (!liveIds.has(id)) {
            m.remove();
            markerMap.delete(id);
        }
    }

    for (const pin of props.pins) {
        if (!markerMap.has(pin.id)) {
            addMarker(pin);
        }
    }

    if (markerMap.size > 0) {
        const group = L.featureGroup(Array.from(markerMap.values()));
        map.fitBounds(group.getBounds().pad(0.3));
    } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
}

onMounted(async () => {
    if (!mapEl.value) return;
    map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);
    await nextTick();
    map.invalidateSize();
    syncMarkers();
});

watch(() => props.pins, syncMarkers, { deep: true });

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <div ref="mapEl" :class="['w-full rounded-lg z-0', height]"></div>
</template>
