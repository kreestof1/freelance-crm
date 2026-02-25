import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PipelineStageOut {
    id: string
    name: string
    order: number
    default_probability: number
    is_closed: boolean
    is_won: boolean
    color: string | null
}

export interface DealOut {
    id: string
    title: string
    amount: string
    currency: string
    probability: number
    stage: string
    expected_close: string | null
    origin: string | null
    notes: string | null
    tags: string[]
    is_locked: boolean
    weighted_amount: string
    company_id: string | null
    contact_id: string | null
    company_name: string | null
    contact_name: string | null
    has_project: boolean
    created_at: string
    updated_at: string
}

export interface DealCreate {
    title: string
    amount?: string | number
    currency?: string
    probability?: number
    stage?: string
    expected_close?: string | null
    origin?: string | null
    notes?: string | null
    tags?: string[]
    company_id?: string | null
    contact_id?: string | null
}

export interface DealPatch {
    title?: string
    amount?: string | number
    currency?: string
    probability?: number
    stage?: string
    expected_close?: string | null
    origin?: string | null
    notes?: string | null
    tags?: string[]
    company_id?: string | null
    contact_id?: string | null
}

export interface DealMove {
    stage: string
}

export interface DealList {
    items: DealOut[]
    total: number
    page: number
    page_size: number
}

export interface DealListParams {
    stage?: string
    close_before?: string
    company_id?: string
    page?: number
    page_size?: number
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const dealKeys = {
    all: ['deals'] as const,
    list: (params?: DealListParams) => [...dealKeys.all, 'list', params] as const,
    detail: (id: string) => [...dealKeys.all, 'detail', id] as const,
    stages: () => ['pipeline', 'stages'] as const,
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const dealsApi = {
    list: (params?: DealListParams) =>
        apiClient.get<DealList>('/deals', { params }).then((r) => r.data),
    get: (id: string) => apiClient.get<DealOut>(`/deals/${id}`).then((r) => r.data),
    create: (data: DealCreate) => apiClient.post<DealOut>('/deals', data).then((r) => r.data),
    patch: (id: string, data: DealPatch) =>
        apiClient.patch<DealOut>(`/deals/${id}`, data).then((r) => r.data),
    move: (id: string, data: DealMove) =>
        apiClient.post<DealOut>(`/deals/${id}/move`, data).then((r) => r.data),
    delete: (id: string) => apiClient.delete(`/deals/${id}`).then((r) => r.data),
    getStages: () =>
        apiClient.get<PipelineStageOut[]>('/pipeline/stages').then((r) => r.data),
    updateStages: (stages: Omit<PipelineStageOut, 'id' | 'created_at' | 'updated_at'>[]) =>
        apiClient.put<PipelineStageOut[]>('/pipeline/stages', { stages }).then((r) => r.data),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDeals(params?: DealListParams) {
    return useQuery({
        queryKey: dealKeys.list(params),
        queryFn: () => dealsApi.list(params),
    })
}

export function useDeal(id: string) {
    return useQuery({
        queryKey: dealKeys.detail(id),
        queryFn: () => dealsApi.get(id),
        enabled: Boolean(id),
    })
}

export function usePipelineStages() {
    return useQuery({
        queryKey: dealKeys.stages(),
        queryFn: dealsApi.getStages,
        staleTime: 5 * 60 * 1000, // 5 min — les stages changent rarement
    })
}

export function useCreateDeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: DealCreate) => dealsApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: dealKeys.all }),
    })
}

export function usePatchDeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: DealPatch }) => dealsApi.patch(id, data),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: dealKeys.detail(id) })
            qc.invalidateQueries({ queryKey: dealKeys.all })
        },
    })
}

export function useMoveDeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, stage }: { id: string; stage: string }) =>
            dealsApi.move(id, { stage }),
        onSuccess: () => qc.invalidateQueries({ queryKey: dealKeys.all }),
    })
}

export function useDeleteDeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => dealsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: dealKeys.all }),
    })
}
