<script setup lang="ts">
defineProps<{
    label: string;
    value: number;
    sublabel?: string;
    color?: 'red' | 'amber' | 'blue' | 'green' | 'slate';
}>();
</script>

<template>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{{ label }}</p>
        <p
            class="text-3xl font-bold"
            :class="{
                'text-red-600': color === 'red',
                'text-amber-500': color === 'amber',
                'text-blue-600': color === 'blue',
                'text-green-600': color === 'green',
                'text-slate-800': !color || color === 'slate',
            }"
        >
            {{ value }}
        </p>
        <p v-if="sublabel" class="text-xs text-slate-400 mt-1">{{ sublabel }}</p>
    </div>
</template>
