import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: null as string | null,
        user: null as {
            id: string;
            email: string;
            role: string;
            workspaceId: string
        } | null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
    },
    actions: {
        setAuth(token: string, user: {
            id: string;
            email: string;
            role: string;
            workspaceId: string
        }) {
            this.token = token
            this.user = user
        },
        logout() {
            this.token = null
            this.user = null
        },
    },
})