import { defineStore } from 'pinia'

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'caseworker';
    workspaceId: string;
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') as string | null,
        user: JSON.parse(localStorage.getItem('user') as string) as User | null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.token,
        isAdmin: (state) => state.user?.role === 'admin',
    },
    actions: {
        setAuth(token: string, user: User) {
            this.token = token
            this.user = user
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        },
        updateUser(fields: Partial<User>) {
            if (!this.user) return;
            this.user = { ...this.user, ...fields };
            localStorage.setItem('user', JSON.stringify(this.user));
        },
        logout() {
            this.token = null
            this.user = null
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
    },
})