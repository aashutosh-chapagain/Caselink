<script setup lang="ts">
import type { WorkloadRow } from '../api/dashboard';

defineProps<{ workload: WorkloadRow[] }>();
</script>

<template>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 class="text-sm font-semibold text-slate-700 mb-4">Caseworker Workload</h2>
        <div v-if="workload.length === 0" class="text-sm text-slate-400">No assigned cases.</div>
        <table v-else class="w-full text-sm">
            <thead>
                <tr class="border-b border-slate-100">
                    <th class="text-left py-2 font-medium text-slate-500">Caseworker</th>
                    <th class="text-right py-2 font-medium text-slate-500">Open</th>
                    <th class="text-right py-2 font-medium text-slate-500">In Progress</th>
                    <th class="text-right py-2 font-medium text-slate-500">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="row in workload"
                    :key="row._id"
                    class="border-b border-slate-50 last:border-0"
                >
                    <td class="py-2 text-slate-700">{{ row.name ?? '—' }}</td>
                    <td class="py-2 text-right text-blue-600">{{ row.open }}</td>
                    <td class="py-2 text-right text-amber-500">{{ row.inProgress }}</td>
                    <td class="py-2 text-right font-medium text-slate-700">{{ row.open + row.inProgress }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
