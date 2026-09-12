<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Suggestion {
    display_name: string;
    lat: string;
    lon: string;
}

const emit = defineEmits<{
    select: [{ address: string; lat: number; lng: number }];
}>();

const query = ref('');
const suggestions = ref<Suggestion[]>([]);
const loading = ref(false);
const showDropdown = ref(false);
const container = ref<HTMLElement | null>(null);

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
    loading.value = true;
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
        loading.value = false;
    }
}

function selectSuggestion(s: Suggestion) {
    query.value = s.display_name;
    showDropdown.value = false;
    suggestions.value = [];
    emit('select', {
        address: s.display_name,
        lat: parseFloat(s.lat),
        lng: parseFloat(s.lon),
    });
}

function clear() {
    query.value = '';
    suggestions.value = [];
    showDropdown.value = false;
    emit('select', { address: '', lat: 0, lng: 0 });
}

function handleClickOutside(e: MouseEvent) {
    if (container.value && !container.value.contains(e.target as Node)) {
        showDropdown.value = false;
    }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside));
onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
    <div ref="container" class="relative">
        <div class="relative">
            <input
                v-model="query"
                @input="onInput"
                type="text"
                placeholder="Start typing an address..."
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm pr-16"
            />
            <div class="absolute right-2 top-2 flex items-center gap-1">
                <span v-if="loading" class="text-xs text-slate-400">Searching…</span>
                <button
                    v-else-if="query"
                    type="button"
                    @click="clear"
                    class="text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                    ✕
                </button>
            </div>
        </div>

        <ul
            v-if="showDropdown"
            class="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto"
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
</template>
