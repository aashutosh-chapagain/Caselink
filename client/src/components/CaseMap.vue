<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icons break in Vite because the image URLs are
// resolved at build time differently. We fix this by pointing directly to
// the dist files.
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

const props = defineProps<{
    lat: number;
    lng: number;
    label?: string;
}>();

const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let marker: L.Marker | null = null;

onMounted(() => {
    if (!mapEl.value) return;

    map = L.map(mapEl.value).setView([props.lat, props.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

    marker = L.marker([props.lat, props.lng]).addTo(map);

    if (props.label) {
        marker.bindPopup(props.label).openPopup();
    }
});

watch(() => [props.lat, props.lng, props.label] as const, ([lat, lng, label]) => {
    if (!map || !marker) return;
    const latlng: L.LatLngExpression = [lat, lng];
    map.setView(latlng, map.getZoom());
    marker.setLatLng(latlng);
    if (label) {
        marker.bindPopup(label).openPopup();
    }
});

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <div ref="mapEl" class="w-full h-56 rounded-lg overflow-hidden z-0"></div>
</template>
