import { defineStore } from 'pinia'
import { getCases, type Case } from '../api/cases'

export const useCasesStore = defineStore('cases', {
    state: () => ({
        activeCases: [] as Case[],
        closedCases: [] as Case[],
        closedHasMore: false,
        closedCursor: null as string | null,
        loading: false,
        closedLoading: false,
        error: null as string | null,
    }),
    actions: {
        async fetchActiveCases() {
            this.loading = true
            this.error = null
            try {
                const res = await getCases({ status: 'open,in_progress' })
                this.activeCases = res.data.cases
            } catch (err: any) {
                this.error = err.response?.data?.error || 'Failed to load cases'
            } finally {
                this.loading = false
            }
        },
        async fetchClosedCases() {
            this.closedLoading = true
            this.error = null
            this.closedCases = []
            this.closedCursor = null
            try {
                const res = await getCases({ status: 'closed', limit: 20 })
                this.closedCases = res.data.cases
                this.closedHasMore = res.data.hasMore
                this.closedCursor = res.data.cases.at(-1)?._id ?? null
            } catch (err: any) {
                this.error = err.response?.data?.error || 'Failed to load closed cases'
            } finally {
                this.closedLoading = false
            }
        },
        async loadMoreClosed() {
            if (!this.closedHasMore || !this.closedCursor) return
            this.closedLoading = true
            try {
                const res = await getCases({ status: 'closed', limit: 20, cursor: this.closedCursor })
                this.closedCases.push(...res.data.cases)
                this.closedHasMore = res.data.hasMore
                this.closedCursor = res.data.cases.at(-1)?._id ?? null
            } finally {
                this.closedLoading = false
            }
        },
        addCase(newCase: Case) {
            this.activeCases.unshift(newCase)
        },
        updateCase(updated: Case) {
            const activeIdx = this.activeCases.findIndex(c => c._id === updated._id)
            if (activeIdx !== -1) {
                if (updated.status === 'closed') {
                    this.activeCases.splice(activeIdx, 1)
                } else {
                    this.activeCases[activeIdx] = updated
                }
                return
            }
            const closedIdx = this.closedCases.findIndex(c => c._id === updated._id)
            if (closedIdx !== -1) this.closedCases[closedIdx] = updated
        },
    },
})
