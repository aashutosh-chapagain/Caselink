<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { getInvitePreview, acceptInvite } from '../api/invites';
import PasswordInput from '../components/PasswordInput.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = route.query.token as string;

const preview = ref<{ email: string; workspaceName: string } | null>(null);
const tokenError = ref('');
const loadingPreview = ref(true);

const form = ref({ name: '', password: '' });
const submitError = ref('');
const submitting = ref(false);

onMounted(async () => {
    if (!token) {
        tokenError.value = 'Invalid invite link.';
        loadingPreview.value = false;
        return;
    }
    try {
        const res = await getInvitePreview(token);
        preview.value = res.data;
    } catch {
        tokenError.value = 'This invite link is invalid or has expired.';
    } finally {
        loadingPreview.value = false;
    }
});

async function handleAccept() {
    submitError.value = '';
    submitting.value = true;
    try {
        const res = await acceptInvite(token, form.value.name, form.value.password);
        authStore.setAuth(res.data.token, res.data.user);
        router.push('/dashboard');
    } catch (err: any) {
        submitError.value = err.response?.data?.error || 'Failed to create account';
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="flex items-center justify-center bg-slate-100 min-h-screen px-4">
        <div class="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-5">

            <div v-if="loadingPreview" class="text-sm text-slate-500 text-center py-4">
                Validating invite...
            </div>

            <div v-else-if="tokenError" class="text-center space-y-3">
                <p class="text-red-600 text-sm">{{ tokenError }}</p>
                <router-link to="/" class="text-sm text-blue-600 hover:underline">Go to sign in</router-link>
            </div>

            <template v-else-if="preview">
                <div>
                    <h1 class="text-2xl font-bold text-slate-800">Accept invite</h1>
                    <p class="text-sm text-slate-500 mt-1">
                        You're joining <span class="font-medium text-slate-700">{{ preview.workspaceName }}</span>
                    </p>
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
                    Signing up as <span class="font-medium">{{ preview.email }}</span>
                </div>

                <form @submit.prevent="handleAccept" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Your name</label>
                        <input
                            v-model="form.name"
                            type="text"
                            required
                            placeholder="Full name"
                            class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-1">Password</label>
                        <PasswordInput v-model="form.password" placeholder="At least 8 characters" :minlength="8" required />
                    </div>

                    <p v-if="submitError" class="text-red-600 text-sm">{{ submitError }}</p>

                    <button
                        type="submit"
                        :disabled="submitting"
                        class="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {{ submitting ? 'Creating account...' : 'Create account' }}
                    </button>
                </form>
            </template>

        </div>
    </div>
</template>
