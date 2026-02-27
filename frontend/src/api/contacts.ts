import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactOut {
    id: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    phone?: string | null
    role?: string | null
    company_id?: string | null
    company_name?: string | null
    tags: string[]
    notes?: string | null
    consent_rgpd: boolean
    consent_date?: string | null
    anonymized_at?: string | null
    anonymized_stats?: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export interface ContactCreate {
    first_name?: string | null
    last_name?: string | null
    email: string
    phone?: string | null
    role?: string | null
    company_id?: string | null
    tags?: string[]
    notes?: string | null
}

export type ContactUpdate = Partial<ContactCreate>

export interface ContactList {
    items: ContactOut[]
    total: number
    page: number
    page_size: number
}

export interface ContactListParams {
    search?: string
    tag?: string
    company_id?: string
    page?: number
    page_size?: number
}

export interface ContactMergeRequest {
    source_id: string
    target_id: string
}

export interface CsvColumnMapping {
    detected_mapping: Record<string, string>
    sample_rows: Record<string, string>[]
}

export interface CsvImportResult {
    success: number
    errors: { line: number; message: string }[]
}

export interface CsvImportOptions {
    file: File
    column_mapping: Record<string, string>
    all_or_nothing?: boolean
}

// ── API functions ─────────────────────────────────────────────────────────────

export const contactsApi = {
    list: (params?: ContactListParams) =>
        apiClient.get<ContactList>('/contacts', { params }).then((r) => r.data),

    get: (id: string) =>
        apiClient.get<ContactOut>(`/contacts/${id}`).then((r) => r.data),

    create: (data: ContactCreate) =>
        apiClient.post<ContactOut>('/contacts', data).then((r) => r.data),

    update: (id: string, data: ContactUpdate) =>
        apiClient.put<ContactOut>(`/contacts/${id}`, data).then((r) => r.data),

    delete: (id: string) =>
        apiClient.delete(`/contacts/${id}`),

    merge: (data: ContactMergeRequest) =>
        apiClient.post<ContactOut>('/contacts/merge', data).then((r) => r.data),

    detectCsvMapping: (file: File) => {
        const fd = new FormData()
        fd.append('file', file)
        return apiClient
            .post<CsvColumnMapping>('/contacts/import/detect', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => r.data)
    },

    importCsv: ({ file, column_mapping, all_or_nothing = false }: CsvImportOptions) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('column_mapping', JSON.stringify(column_mapping))
        fd.append('all_or_nothing', String(all_or_nothing))
        return apiClient
            .post<CsvImportResult>('/contacts/import', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => r.data)
    },

    anonymize: (id: string) =>
        apiClient.post<ContactOut>(`/contacts/${id}/anonymize`).then((r) => r.data),
}

// ── TanStack Query hooks ──────────────────────────────────────────────────────

export const CONTACTS_KEY = 'contacts'

export function useContacts(params?: ContactListParams) {
    return useQuery({
        queryKey: [CONTACTS_KEY, params],
        queryFn: () => contactsApi.list(params),
    })
}

export function useContact(id: string) {
    return useQuery({
        queryKey: [CONTACTS_KEY, id],
        queryFn: () => contactsApi.get(id),
        enabled: !!id,
    })
}

export function useCreateContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: ContactCreate) => contactsApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CONTACTS_KEY] }),
    })
}

export function useUpdateContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ContactUpdate }) =>
            contactsApi.update(id, data),
        onSuccess: (_data, { id }) => {
            qc.invalidateQueries({ queryKey: [CONTACTS_KEY] })
            qc.invalidateQueries({ queryKey: [CONTACTS_KEY, id] })
        },
    })
}

export function useDeleteContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => contactsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CONTACTS_KEY] }),
    })
}

export function useMergeContacts() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: ContactMergeRequest) => contactsApi.merge(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CONTACTS_KEY] }),
    })
}

export function useImportContactsCsv() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (options: CsvImportOptions) => contactsApi.importCsv(options),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CONTACTS_KEY] }),
    })
}

export function useAnonymizeContact() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => contactsApi.anonymize(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: [CONTACTS_KEY] }),
    })
}
