/**
 * Export CSV — triggers browser file download via the /export/* API endpoints.
 */
import { apiClient } from './client'

type ExportParams = Record<string, string | undefined>

async function downloadCsv(url: string, params: ExportParams, filename: string): Promise<void> {
    const response = await apiClient.get<BlobPart>(url, {
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
        responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(href)
}

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

export const exportApi = {
    contacts: (params?: { tag?: string }) =>
        downloadCsv('/export/contacts', { tag: params?.tag }, `contacts_${today()}.csv`),

    deals: (params?: { stage?: string; close_before?: string }) =>
        downloadCsv(
            '/export/deals',
            { stage: params?.stage, close_before: params?.close_before },
            `deals_${today()}.csv`,
        ),

    projects: (params?: { status?: string }) =>
        downloadCsv('/export/projects', { status: params?.status }, `projects_${today()}.csv`),
}
