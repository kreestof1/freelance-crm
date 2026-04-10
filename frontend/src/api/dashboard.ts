import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StageAggregate {
    stage: string
    count: number
    total_amount: string
    weighted_amount: string
    color: string | null
}

export interface PipelineDashboard {
    stages: StageAggregate[]
    total_count: number
    total_amount: string
    total_weighted: string
}

export interface ForecastPeriod {
    label: string
    period_start: string
    period_end: string
    count: number
    total_amount: string
    weighted_amount: string
}

export interface ForecastDashboard {
    current_month: ForecastPeriod
    next_3_months: ForecastPeriod[]
}

export interface MissionMonthPoint {
    label: string
    month: string   // YYYY-MM
    count: number
}

export interface MissionsPerMonthDashboard {
    points: MissionMonthPoint[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
    pipeline: () => apiClient.get<PipelineDashboard>('/dashboard/pipeline').then((r) => r.data),
    forecast: () => apiClient.get<ForecastDashboard>('/dashboard/forecast').then((r) => r.data),
    missionsPerMonth: () => apiClient.get<MissionsPerMonthDashboard>('/dashboard/missions-per-month').then((r) => r.data),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePipelineDashboard() {
    return useQuery({
        queryKey: ['dashboard', 'pipeline'],
        queryFn: dashboardApi.pipeline,
        staleTime: 30_000, // 30s
    })
}

export function useForecastDashboard() {
    return useQuery({
        queryKey: ['dashboard', 'forecast'],
        queryFn: dashboardApi.forecast,
        staleTime: 60_000, // 1min
    })
}

export function useMissionsPerMonth() {
    return useQuery({
        queryKey: ['dashboard', 'missions-per-month'],
        queryFn: dashboardApi.missionsPerMonth,
        staleTime: 60_000,
    })
}
