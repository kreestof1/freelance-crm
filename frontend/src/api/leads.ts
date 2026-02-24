import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeadStatus = 'Nouveau' | 'Qualifié' | 'Converti' | 'Perdu'
export type LeadSource =
    | 'web'
    | 'recommandation'
    | 'evenement'
    | 'réseau'
    | 'publicité'
    | 'other'

export interface LeadOut {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    source: LeadSource
    status: LeadStatus
    score?: number | null
    company_id?: string | null
    company_name?: string | null
    contact_id?: string | null
    tags: string[]
    notes?: string | null
    created_at: string
    updated_at: string
}

export interface LeadCreate {
    name: string
    email?: string | null
    phone?: string | null
    source: LeadSource
    status?: LeadStatus
    score?: number | null
    company_id?: string | null
    tags?: string[]
    notes?: string | null
}

export interface LeadPatch {
    name?: string | null
    email?: string | null
    phone?: string | null
    source?: LeadSource
    status?: LeadStatus
    score?: number | null
    company_id?: string | null
    tags?: string[]
    notes?: string | null
}

export interface LeadList {
    items: LeadOut[]
    total: number
    page: number
    page_size: number
}

export interface LeadListParams {
    search?: string
    status?: LeadStatus
    source?: LeadSource
    tag?: string
    page?: number
    page_size?: number
}

export interface LeadConvertRequest {
    deal_title: string
    deal_amount?: number | null
    deal_stage?: string | null
    create_contact?: boolean
    existing_contact_id?: string | null
}

export interface LeadConvertResult {
    contact_id?: string | null
    deal_id: string
    lead_id: string
}

// ── API functions ─────────────────────────────────────────────────────────────

export const leadsApi = {
    list: (params?: LeadListParams) =>
        apiClient.get<LeadList>('/leads', { params }).then((r) => r.data),

    get: (id: string) =>
        apiClient.get<LeadOut>(`/leads/${id}`).then((r) => r.data),

    create: (data: LeadCreate) =>
        apiClient.post<LeadOut>('/leads', data).then((r) => r.data),

    patch: (id: string, data: LeadPatch) =>
        apiClient.patch<LeadOut>(`/leads/${id}`, data).then((r) => r.data),

    delete: (id: string) =>
        apiClient.delete(`/leads/${id}`),

    convert: (id: string, data: LeadConvertRequest) =>
        apiClient.post<LeadConvertResult>(`/leads/${id}/convert`, data).then((r) => r.data),
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export const LEADS_KEY = 'leads'

export function useLeads(params?: LeadListParams) {
    return useQuery({
        queryKey: [LEADS_KEY, params],
        queryFn: () => leadsApi.list(params),
    })
}

export function useLead(id: string) {
    return useQuery({
        queryKey: [LEADS_KEY, id],
        queryFn: () => leadsApi.get(id),
        enabled: !!id,
    })
}

export function useCreateLead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: LeadCreate) => leadsApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
    })
}

export function usePatchLead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: LeadPatch }) =>
            leadsApi.patch(id, data),
        onSuccess: (_data, { id }) => {
            qc.invalidateQueries({ queryKey: [LEADS_KEY] })
            qc.invalidateQueries({ queryKey: [LEADS_KEY, id] })
        },
    })
}

export function useDeleteLead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => leadsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: [LEADS_KEY] }),
    })
}

export function useConvertLead() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: LeadConvertRequest }) =>
            leadsApi.convert(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [LEADS_KEY] })
        },
    })
}
