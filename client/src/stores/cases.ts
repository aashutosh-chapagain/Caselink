import { defineStore } from 'pinia'
import { getCases, type Case } from '../api/cases'

export const useCasesStore = defineStore('cases', {
    state: () => ({
        cases: [] as Case[],
        loading: false,
        error: null as string | null,
    }),
    actions: {
        async fetchCases(status?: string) {
            this.loading = true
            this.error = null
            try {
                const res = await getCases(status)
                this.cases = res.data
            } catch (err: any) {
                this.error = err.response?.data?.error || 'Failed to load cases'
            } finally {
                this.loading = false
            }
        },
        addCase(newCase: Case) {
            this.cases.unshift(newCase)
        },
        updateCase(updated: Case) {
            const index = this.cases.findIndex(c => c._id === updated._id)
            if (index !== -1) this.cases[index] = updated
        },
    },
})
