import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'Planifié' | 'En cours' | 'Suspendu' | 'Clôturé'
export type MilestoneStatus = 'Pending' | 'Done' | 'Delayed'
export type RateType = 'tjm' | 'forfait'

export interface MilestoneOut {
    id: string
    project_id: string
    name: string
    due_date: string | null
    amount: string | null
    status: MilestoneStatus
    created_at: string
    updated_at: string
}

export interface ProjectOut {
    id: string
    title: string
    status: ProjectStatus
    start_date: string | null
    end_date: string | null
    rate_type: RateType
    rate_value: string
    budget_days: string | null
    budget_amount: string | null
    notes: string | null
    company_id: string | null
    contact_id: string | null
    deal_id: string | null
    created_at: string
    updated_at: string
    milestones: MilestoneOut[]
    company_name: string | null
    contact_name: string | null
    deal_title: string | null
    milestones_total: number
    milestones_done: number
    upcoming_milestones: MilestoneOut[]
}

export interface ProjectCreate {
    title: string
    status?: ProjectStatus
    start_date?: string | null
    end_date?: string | null
    rate_type?: RateType
    rate_value?: string | number
    budget_days?: string | number | null
    budget_amount?: string | number | null
    notes?: string | null
    company_id?: string | null
    contact_id?: string | null
    deal_id?: string | null
}

export interface ProjectPatch {
    title?: string
    status?: ProjectStatus
    start_date?: string | null
    end_date?: string | null
    rate_type?: RateType
    rate_value?: string | number
    budget_days?: string | number | null
    budget_amount?: string | number | null
    notes?: string | null
    company_id?: string | null
    contact_id?: string | null
}

export interface ProjectList {
    items: ProjectOut[]
    total: number
    page: number
    page_size: number
}

export interface MilestoneCreate {
    name: string
    due_date?: string | null
    amount?: string | number | null
    status?: MilestoneStatus
}

export interface MilestonePatch {
    name?: string
    due_date?: string | null
    amount?: string | number | null
    status?: MilestoneStatus
}

// ── Keys ─────────────────────────────────────────────────────────────────────

export const projectKeys = {
    all: ['projects'] as const,
    list: (params?: object) => [...projectKeys.all, 'list', params] as const,
    detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useProjects(params?: { status?: string; company_id?: string; page?: number }) {
    return useQuery({
        queryKey: projectKeys.list(params),
        queryFn: () =>
            apiClient
                .get<ProjectList>('/projects', { params })
                .then((r) => r.data),
    })
}

export function useProject(id: string | undefined) {
    return useQuery({
        queryKey: projectKeys.detail(id!),
        queryFn: () => apiClient.get<ProjectOut>(`/projects/${id}`).then((r) => r.data),
        enabled: !!id,
    })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateProject() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: ProjectCreate) =>
            apiClient.post<ProjectOut>('/projects', data).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    })
}

export function usePatchProject() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ProjectPatch }) =>
            apiClient.patch<ProjectOut>(`/projects/${id}`, data).then((r) => r.data),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: projectKeys.all })
            qc.invalidateQueries({ queryKey: projectKeys.detail(id) })
        },
    })
}

export function useDeleteProject() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.delete(`/projects/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    })
}

export function useCreateProjectFromDeal() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (dealId: string) =>
            apiClient.post<ProjectOut>(`/deals/${dealId}/create_project`).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    })
}

// ── Milestone mutations ───────────────────────────────────────────────────────

export function useAddMilestone(projectId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: MilestoneCreate) =>
            apiClient.post<MilestoneOut>(`/projects/${projectId}/milestones`, data).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    })
}

export function usePatchMilestone(projectId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ milestoneId, data }: { milestoneId: string; data: MilestonePatch }) =>
            apiClient
                .patch<MilestoneOut>(`/projects/${projectId}/milestones/${milestoneId}`, data)
                .then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    })
}

export function useDeleteMilestone(projectId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (milestoneId: string) =>
            apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
    })
}
