<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

// ---------------------------------------------------------------------------
// Props / emits
// ---------------------------------------------------------------------------

const props = withDefaults(defineProps<{
    initialAddress?: string;
    initialLat?: number;
    initialLng?: number;
}>(), {
    initialAddress: '',
    initialLat: undefined,
    initialLng: undefined,
});

const emit = defineEmits<{
    select: [{ address: string; lat: number; lng: number; region: string }];
}>();

// ---------------------------------------------------------------------------
// Search state
// ---------------------------------------------------------------------------

interface NominatimAddress {
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
}

interface Suggestion {
    display_name: string;
    lat: string;
    lon: string;
    address?: NominatimAddress;
}

function extractRegion(addr?: NominatimAddress): string {
    if (!addr) return '';
    return addr.suburb || addr.city || addr.town || addr.village || addr.county || '';
}

const query       = ref(props.initialAddress ?? '');
const suggestions = ref<Suggestion[]>([]);
const showDropdown = ref(false);
const searching   = ref(false);
const reversing   = ref(false);
const container   = ref<HTMLElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!query.value.trim() || query.value.length < 3) {
        suggestions.value = [];
        showDropdown.value = false;
        return;
    }
    debounceTimer = setTimeout(fetchSuggestions, 300);
}

async function fetchSuggestions() {
    searching.value = true;
    try {
        const params = new URLSearchParams({
            q: query.value,
            format: 'json',
            addressdetails: '1',
            countrycodes: 'au',
            limit: '5',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { 'User-Agent': 'Caselink/1.0' },
        });
        suggestions.value = await res.json();
        showDropdown.value = suggestions.value.length > 0;
    } catch {
        suggestions.value = [];
    } finally {
        searching.value = false;
    }
}

function selectSuggestion(s: Suggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    query.value = s.display_name;
    showDropdown.value = false;
    suggestions.value = [];
    placeMarker(lat, lng);
    emit('select', { address: s.display_name, lat, lng, region: extractRegion(s.address) });
}

// ---------------------------------------------------------------------------
// Map / marker
// ---------------------------------------------------------------------------

const DEFAULT_CENTER: L.LatLngExpression = [-31.9505, 115.8605]; // Perth, WA
const DEFAULT_ZOOM = 10;
const PIN_ZOOM     = 15;

const mapEl    = ref<HTMLElement | null>(null);
const pinned   = ref(false); // tracks whether a marker is on the map
let map: L.Map | null = null;
let marker: L.Marker | null = null;

function placeMarker(lat: number, lng: number) {
    if (!map) return;
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', onMarkerDragEnd);
    }
    pinned.value = true;
    map.flyTo([lat, lng], PIN_ZOOM);
}

async function onMapClick(e: L.LeafletMouseEvent) {
    const { lat, lng } = e.latlng;
    placeMarker(lat, lng);
    await reverseGeocode(lat, lng);
}

async function onMarkerDragEnd() {
    if (!marker) return;
    const { lat, lng } = marker.getLatLng();
    await reverseGeocode(lat, lng);
}

// ---------------------------------------------------------------------------
// Reverse geocoding
// ---------------------------------------------------------------------------

async function reverseGeocode(lat: number, lng: number) {
    reversing.value = true;
    try {
        const params = new URLSearchParams({
            lat: String(lat),
            lon: String(lng),
            format: 'json',
            addressdetails: '1',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
            headers: { 'User-Agent': 'Caselink/1.0' },
        });
        const data = await res.json();
        const address = data.display_name ?? '';
        query.value = address;
        emit('select', { address, lat, lng, region: extractRegion(data.address) });
    } catch {
        emit('select', { address: '', lat, lng, region: '' });
    } finally {
        reversing.value = false;
    }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

function clear() {
    query.value = '';
    suggestions.value = [];
    showDropdown.value = false;
    if (marker) {
        marker.remove();
        marker = null;
    }
    pinned.value = false;
    map?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    emit('select', { address: '', lat: 0, lng: 0, region: '' });
}

// ---------------------------------------------------------------------------
// Click-outside closes dropdown
// ---------------------------------------------------------------------------

function handleClickOutside(e: MouseEvent) {
    if (container.value && !container.value.contains(e.target as Node)) {
        showDropdown.value = false;
    }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
    document.addEventListener('mousedown', handleClickOutside);

    if (!mapEl.value) return;

    const hasInitial = props.initialLat != null && props.initialLng != null;
    const center     = hasInitial ? [props.initialLat!, props.initialLng!] as L.LatLngExpression : DEFAULT_CENTER;
    const zoom       = hasInitial ? PIN_ZOOM : DEFAULT_ZOOM;

    map = L.map(mapEl.value, { zoomControl: true }).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

    map.on('click', onMapClick);

    // Let the browser finish laying out the container before Leaflet reads dimensions
    await nextTick();
    map.invalidateSize();

    // Restore existing pin when editing a record that already has coordinates
    if (hasInitial) {
        placeMarker(props.initialLat!, props.initialLng!);
    }
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    if (debounceTimer) clearTimeout(debounceTimer);
    map?.remove();
    map = null;
    marker = null;
});
</script>

<template>
    <div ref="container" class="flex flex-col gap-2">

        <!-- Search row: z-10 so the dropdown floats above the map below it -->
        <div class="relative z-10">
            <input
                v-model="query"
                @input="onInput"
                type="text"
                placeholder="Search address, or click the map to pin…"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm pr-16"
            />
            <div class="absolute right-2 top-1.5 flex items-center gap-1">
                <span v-if="searching || reversing" class="text-xs text-slate-400">Searching…</span>
                <button
                    v-else-if="query"
                    type="button"
                    @click="clear"
                    class="text-slate-400 hover:text-slate-600 text-xs px-1"
                >✕</button>
            </div>

            <!-- Suggestions dropdown -->
            <ul
                v-if="showDropdown"
                class="absolute w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
            >
                <li
                    v-for="s in suggestions"
                    :key="s.display_name"
                    @mousedown.prevent="selectSuggestion(s)"
                    class="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                >
                    {{ s.display_name }}
                </li>
            </ul>
        </div>

        <!-- Map area -->
        <div class="relative">
            <!-- overflow-hidden + rounded on a wrapper so tiles are clipped cleanly -->
            <div class="overflow-hidden rounded-lg border border-slate-200">
                <div ref="mapEl" class="w-full h-56"></div>
            </div>

            <!-- Hint badge — outside the overflow wrapper so it isn't clipped -->
            <div class="absolute bottom-2 left-2 z-[1000] pointer-events-none bg-white/90 backdrop-blur-sm text-xs text-slate-500 px-2 py-1 rounded shadow-sm">
                {{ pinned ? 'Drag pin to fine-tune' : 'Click map to drop a pin' }}
            </div>
        </div>

    </div>
</template>
