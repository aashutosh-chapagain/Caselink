<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createCase, type CasePriority, type CaseType } from '../api/cases';
import LocationPicker from '../components/LocationPicker.vue';

const router = useRouter();

const submitting = ref(false);
const error = ref('');

const form = ref({
    title: '',
    description: '',
    region: '',
    priority: 'medium' as CasePriority,
    type: '' as CaseType | '',
    dueAt: '',
    address: '',
    lat: 0,
    lng: 0,
});

const priorityOptions: { label: string; value: CasePriority }[] = [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
];

const caseTypeOptions: { label: string; value: CaseType }[] = [
    { label: 'Fire', value: 'fire' },
    { label: 'Medical', value: 'medical' },
    { label: 'Welfare Check', value: 'welfare_check' },
    { label: 'Missing Person', value: 'missing_person' },
    { label: 'Hazmat', value: 'hazmat' },
    { label: 'Rescue', value: 'rescue' },
    { label: 'Other', value: 'other' },
];

function onAddressSelect(selected: { address: string; lat: number; lng: number; region: string }) {
    form.value.address = selected.address;
    form.value.lat = selected.lat;
    form.value.lng = selected.lng;
    if (selected.region) form.value.region = selected.region;
}

async function submit() {
    if (!form.value.type) {
        error.value = 'Please select a case type';
        return;
    }
    submitting.value = true;
    error.value = '';
    try {
        const { address, lat, lng, dueAt, ...rest } = form.value;
        const payload = {
            ...rest,
            ...(address && { address, lat, lng }),
            ...(dueAt && { dueAt }),
        };
        const res = await createCase(payload as Parameters<typeof createCase>[0]);
        router.push(`/cases/${res.data._id}`);
    } catch (err: any) {
        error.value = err.response?.data?.error || 'Failed to create case';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-slate-50">
        <div class="max-w-2xl mx-auto px-6 py-8">

            <button @click="router.push('/cases')" class="text-sm text-slate-500 hover:text-slate-700 mb-6 flex items-center gap-1">
                ← Back to Cases
            </button>

            <h1 class="text-2xl font-bold text-slate-800 mb-6">New Case</h1>

            <form @submit.prevent="submit" class="space-y-6">

                <!-- Core fields -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h2 class="text-sm font-semibold text-slate-600 uppercase tracking-wide">Case Details</h2>

                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Title</label>
                        <input
                            v-model="form.title"
                            type="text"
                            required
                            autofocus
                            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Brief title for this case"
                        />
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Description</label>
                        <textarea
                            v-model="form.description"
                            required
                            rows="4"
                            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Describe the situation in detail"
                        />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">Case Type</label>
                            <select
                                v-model="form.type"
                                required
                                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="" disabled>Select type…</option>
                                <option v-for="opt in caseTypeOptions" :key="opt.value" :value="opt.value">
                                    {{ opt.label }}
                                </option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">Priority</label>
                            <select
                                v-model="form.priority"
                                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
                                    {{ opt.label }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">Region</label>
                            <input
                                v-model="form.region"
                                type="text"
                                required
                                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="e.g. Perth Metro"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-600 mb-1">
                                Due Date <span class="text-slate-400 font-normal">(optional)</span>
                            </label>
                            <input
                                v-model="form.dueAt"
                                type="date"
                                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                        </div>
                    </div>
                </div>

                <!-- Location -->
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-3">
                    <h2 class="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                        Location <span class="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
                    </h2>
                    <LocationPicker @select="onAddressSelect" />
                </div>

                <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

                <div class="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        @click="router.push('/cases')"
                        class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        :disabled="submitting"
                        class="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {{ submitting ? 'Creating…' : 'Create Case' }}
                    </button>
                </div>

            </form>
        </div>
    </div>
</template>
