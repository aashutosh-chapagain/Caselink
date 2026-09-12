<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    label: string;
    count: number;
    total: number;
    color: string;
}>();

const pct = computed(() => (props.total > 0 ? Math.round((props.count / props.total) * 100) : 0));
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-slate-600">{{ label }}</span>
            <span class="text-sm font-medium text-slate-700">{{ count }} <span class="text-xs text-slate-400">({{ pct }}%)</span></span>
        </div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
                class="h-full rounded-full transition-all duration-500"
                :class="color"
                :style="{ width: pct + '%' }"
            ></div>
        </div>
    </div>
</template>
