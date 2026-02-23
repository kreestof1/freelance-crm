import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { useAuthStore } from '@/store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityType = 'Appel' | 'Email' | 'Tâche' | 'RDV'
export type ActivityRelatedType = 'contact' | 'deal' | 'project'

export interface ActivityOut {
    id: string
    type: ActivityType
    when: string
    duration_min: number | null
    outcome: string | null
    notes: string | null
    related_type: ActivityRelatedType | null
    related_id: string | null
    related_label: string | null
    reminder_at: string | null
    reminder_sent: boolean
    user_id: string | null
    created_at: string
    updated_at: string
}

export interface ActivityList {
    items: ActivityOut[]
    total: number
}

export interface ActivityCreate {
    type: ActivityType
    when: string
    duration_min?: number | null
    outcome?: string | null
    notes?: string | null
    related_type?: ActivityRelatedType | null
    related_id?: string | null
    reminder_at?: string | null
}

export interface ActivityPatch {
    type?: ActivityType
    when?: string
    duration_min?: number | null
    outcome?: string | null
    notes?: string | null
    related_type?: ActivityRelatedType | null
    related_id?: string | null
    reminder_at?: string | null
    reminder_sent?: boolean
}

export interface ActivitiesParams {
    related_type?: ActivityRelatedType
    related_id?: string
    type?: ActivityType
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
}

// ── Keys ─────────────────────────────────────────────────────────────────────

export const activityKeys = {
    all: ['activities'] as const,
    list: (params: ActivitiesParams) => [...activityKeys.all, 'list', params] as const,
    upcoming: () => [...activityKeys.all, 'upcoming'] as const,
    detail: (id: string) => [...activityKeys.all, 'detail', id] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useActivities(params: ActivitiesParams = {}) {
    return useQuery({
        queryKey: activityKeys.list(params),
        queryFn: () =>
            apiClient
                .get<ActivityList>('/activities', {
                    params: Object.fromEntries(
                        Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
                    ),
                })
                .then((r) => r.data),
    })
}

export function useUpcomingActivities(hours = 48) {
    const accessToken = useAuthStore((s) => s.accessToken)
    return useQuery({
        queryKey: activityKeys.upcoming(),
        enabled: !!accessToken,
        staleTime: 60_000, // 1 minute — évite les requêtes répétées sur focus
        queryFn: () =>
            apiClient
                .get<ActivityList>('/activities/upcoming', { params: { hours } })
                .then((r) => r.data),
    })
}

export function useActivity(id: string | undefined) {
    return useQuery({
        queryKey: activityKeys.detail(id!),
        queryFn: () => apiClient.get<ActivityOut>(`/activities/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateActivity() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: ActivityCreate) =>
            apiClient.post<ActivityOut>('/activities', data).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.all }),
    })
}

export function usePatchActivity() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ActivityPatch }) =>
            apiClient.patch<ActivityOut>(`/activities/${id}`, data).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.all }),
    })
}

export function useDeleteActivity() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.delete(`/activities/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: activityKeys.all }),
    })
}
