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
            path: '/dashboard',
            name: 'dashboard',
            component: () => import('../views/DashboardView.vue'),
            meta: { requiresAuth: true },
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
        {
            path: '/alerts/manage',
            name: 'alerts-manage',
            component: () => import('../views/AlertsManageView.vue'),
            meta: { requiresAuth: true, requiresAdmin: true },
        },
    ]
})

router.beforeEach((to) => {
    const authStore = useAuthStore()
    if (to.name === 'login' && authStore.isAuthenticated) {
        return { name: 'dashboard' }
    }
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login' }
    }
    if (to.meta.requiresAdmin && !authStore.isAdmin) {
        return { name: 'dashboard' }
    }
})

export default router