import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.ts'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'login',
            component: () => import('../views/LoginView.vue'),
        },
        {
            path: `/cases`,
            name: 'cases',
            component: () => import('../views/CaseListView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: `/cases/:id`,
            name: 'case-detail',
            component: () => import('../views/CaseDetailView.vue'),
            meta: { requiresAuth: true },
        },
        {
            path: '/alerts',
            name: 'public-alerts',
            component: () => import('../views/PublicAlertsView.vue'),
        },
    ]
})

router.beforeEach((to) => {
    const authStore = useAuthStore()
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login' }
    }
})

export default router