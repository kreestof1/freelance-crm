import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddressSchema {
    street?: string | null
    city?: string | null
    postal_code?: string | null
    country?: string | null
}

export interface CompanyOut {
    id: string
    name: string
    sector?: string | null
    website?: string | null
    address?: AddressSchema | null
    tags: string[]
    notes?: string | null
    contacts_count: number
    created_at: string
    updated_at: string
}

export interface CompanyCreate {
    name: string
    sector?: string | null
    website?: string | null
    address?: AddressSchema | null
    tags?: string[]
    notes?: string | null
}

export type CompanyUpdate = Partial<CompanyCreate>

export interface CompanyList {
    items: CompanyOut[]
    total: number
    page: number
    page_size: number
}

export interface CompanyListParams {
    search?: string
    tag?: string
    page?: number
    page_size?: number
}

// ── API functions ─────────────────────────────────────────────────────────────

export const companiesApi = {
    list: (params?: CompanyListParams) =>
        apiClient.get<CompanyList>('/companies', { params }).then((r) => r.data),

    get: (id: string) =>
        apiClient.get<CompanyOut>(`/companies/${id}`).then((r) => r.data),

    create: (data: CompanyCreate) =>
        apiClient.post<CompanyOut>('/companies', data).then((r) => r.data),

    update: (id: string, data: CompanyUpdate) =>
        apiClient.put<CompanyOut>(`/companies/${id}`, data).then((r) => r.data),

    delete: (id: string) =>
        apiClient.delete(`/companies/${id}`),
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export const COMPANIES_KEY = 'companies'

export function useCompanies(params?: CompanyListParams) {
    return useQuery({
        queryKey: [COMPANIES_KEY, params],
        queryFn: () => companiesApi.list(params),
    })
}

export function useCompany(id: string) {
    return useQuery({
        queryKey: [COMPANIES_KEY, id],
        queryFn: () => companiesApi.get(id),
        enabled: !!id,
    })
}

export function useCreateCompany() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: CompanyCreate) => companiesApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANIES_KEY] }),
    })
}

export function useUpdateCompany() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: CompanyUpdate }) =>
            companiesApi.update(id, data),
        onSuccess: (_data, { id }) => {
            qc.invalidateQueries({ queryKey: [COMPANIES_KEY] })
            qc.invalidateQueries({ queryKey: [COMPANIES_KEY, id] })
        },
    })
}

export function useDeleteCompany() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => companiesApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANIES_KEY] }),
    })
}
