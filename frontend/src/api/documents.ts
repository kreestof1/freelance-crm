import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentType = 'Brief' | 'Proposition' | 'Contrat' | 'Autre'
export type RelatedType = 'deal' | 'project'

export interface DocumentOut {
    id: string
    type: DocumentType
    filename: string
    file_uri: string | null
    external_url: string | null
    version: number
    mime_type: string | null
    size_bytes: number | null
    related_type: RelatedType | null
    related_id: string | null
    created_at: string
    signed_url: string | null
}

export interface DocumentList {
    items: DocumentOut[]
    total: number
}

// ── Keys ─────────────────────────────────────────────────────────────────────

export const documentKeys = {
    all: ['documents'] as const,
    list: (relatedType: string, relatedId: string) =>
        [...documentKeys.all, 'list', relatedType, relatedId] as const,
    globalList: (params: Record<string, string | undefined>) =>
        [...documentKeys.all, 'global', params] as const,
    detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useDocuments(relatedType: RelatedType, relatedId: string | undefined) {
    return useQuery({
        queryKey: documentKeys.list(relatedType, relatedId ?? ''),
        queryFn: () =>
            apiClient
                .get<DocumentList>('/documents', {
                    params: { related_type: relatedType, related_id: relatedId },
                })
                .then((r) => r.data),
        enabled: !!relatedId,
    })
}

export function useDocument(id: string | undefined) {
    return useQuery({
        queryKey: documentKeys.detail(id!),
        queryFn: () => apiClient.get<DocumentOut>(`/documents/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

export interface AllDocumentsParams {
    type?: DocumentType
    related_type?: RelatedType
}

export function useAllDocuments(params: AllDocumentsParams = {}) {
    return useQuery({
        queryKey: documentKeys.globalList(params as Record<string, string | undefined>),
        queryFn: () =>
            apiClient
                .get<DocumentList>('/documents', {
                    params: Object.fromEntries(
                        Object.entries(params).filter(([, v]) => v !== undefined),
                    ),
                })
                .then((r) => r.data),
    })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUploadDocument() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({
            file,
            type,
            relatedType,
            relatedId,
            externalUrl,
        }: {
            file?: File
            type: DocumentType
            relatedType: RelatedType
            relatedId: string
            externalUrl?: string
        }) => {
            const form = new FormData()
            form.append('type', type)
            form.append('related_type', relatedType)
            form.append('related_id', relatedId)
            if (file) {
                form.append('file', file)
            } else if (externalUrl) {
                form.append('external_url', externalUrl)
            }
            return apiClient.post<DocumentOut>('/documents', form).then((r) => r.data)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
    })
}

export function useDeleteDocument() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.delete(`/documents/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
    })
}
