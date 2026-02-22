import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchEntityType = 'contact' | 'company' | 'lead' | 'deal' | 'project'

export interface SearchHit {
    type: SearchEntityType
    id: string
    title: string
    excerpt: string | null
}

export interface SearchResult {
    hits: SearchHit[]
    total: number
    query: string
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSearch(
    query: string,
    options: { types?: SearchEntityType[]; limit?: number; enabled?: boolean } = {},
) {
    const { types, limit = 20, enabled = true } = options
    return useQuery({
        queryKey: ['search', query, types, limit],
        queryFn: () =>
            apiClient
                .get<SearchResult>('/search', {
                    params: {
                        q: query,
                        ...(types?.length ? { types: types.join(',') } : {}),
                        limit,
                    },
                })
                .then((r) => r.data),
        enabled: enabled && query.trim().length >= 1,
        staleTime: 30_000,
    })
}
