import React, { useState } from 'react'
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagsInput } from '@/components/common/TagsInput'
import {
    useLeads,
    useCreateLead,
    useDeleteLead,
    useConvertLead,
    type LeadOut,
    type LeadStatus,
    type LeadSource,
} from '@/api/leads'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: LeadStatus[] = ['Nouveau', 'Qualifié', 'Converti', 'Perdu']
const SOURCE_OPTIONS: LeadSource[] = ['web', 'linkedin', 'referral', 'email', 'phone', 'event', 'other']

const STATUS_COLORS: Record<LeadStatus, 'default' | 'primary' | 'success' | 'error'> = {
    Nouveau: 'default',
    Qualifié: 'primary',
    Converti: 'success',
    Perdu: 'error',
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createLeadSchema = z.object({
    name: z.string().min(1, 'Requis'),
    email: z.string().email('Email invalide').optional().or(z.literal('')),
    phone: z.string().optional(),
    source: z.enum(['web', 'linkedin', 'referral', 'email', 'phone', 'event', 'other']),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
})

const convertSchema = z.object({
    deal_title: z.string().min(1, 'Requis'),
    deal_amount: z.coerce.number().min(0).optional(),
    deal_stage: z.string().optional(),
    create_contact: z.boolean().default(true),
})

type CreateLeadForm = z.infer<typeof createLeadSchema>
type ConvertForm = z.infer<typeof convertSchema>

// ── Create Lead Dialog ────────────────────────────────────────────────────────

function CreateLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createLead = useCreateLead()
    const { control, handleSubmit, reset, setValue, watch } = useForm<CreateLeadForm>({
        resolver: zodResolver(createLeadSchema),
        defaultValues: { source: 'web', tags: [] },
    })
    const tags = watch('tags')

    const onSubmit = async (data: CreateLeadForm) => {
        await createLead.mutateAsync({ ...data, email: data.email || undefined })
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Nouveau prospect</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Controller
                            name="name"
                            control={control}
                            render={({ field, fieldState }) => (
                                <TextField {...field} label="Nom *" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                            )}
                        />
                        <Controller
                            name="email"
                            control={control}
                            render={({ field, fieldState }) => (
                                <TextField {...field} label="Email" type="email" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                            )}
                        />
                        <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => <TextField {...field} label="Téléphone" fullWidth size="small" />}
                        />
                        <Controller
                            name="source"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} select label="Source *" fullWidth size="small">
                                    {SOURCE_OPTIONS.map((s) => (
                                        <MenuItem key={s} value={s}>{s}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />
                        <TagsInput value={tags} onChange={(t) => setValue('tags', t)} />
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => <TextField {...field} label="Notes" multiline rows={3} fullWidth size="small" />}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" disabled={createLead.isPending}>Créer</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

// ── Convert Lead Dialog ───────────────────────────────────────────────────────

function ConvertLeadDialog({
    lead,
    open,
    onClose,
}: {
    lead: LeadOut | null
    open: boolean
    onClose: () => void
}) {
    const convertLead = useConvertLead()
    const { control, handleSubmit, reset } = useForm<ConvertForm>({
        resolver: zodResolver(convertSchema),
        defaultValues: { deal_stage: 'Qualification', create_contact: true, deal_amount: 0 },
    })

    const onSubmit = async (data: ConvertForm) => {
        if (!lead) return
        await convertLead.mutateAsync({
            id: lead.id,
            data: {
                deal_title: data.deal_title,
                deal_amount: data.deal_amount,
                deal_stage: data.deal_stage || 'Qualification',
                create_contact: data.create_contact,
            },
        })
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Convertir « {lead?.name} »</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Controller
                            name="deal_title"
                            control={control}
                            render={({ field, fieldState }) => (
                                <TextField {...field} label="Titre de l'opportunité *" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                            )}
                        />
                        <Controller
                            name="deal_amount"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} label="Montant (€)" type="number" fullWidth size="small"
                                    InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }} />
                            )}
                        />
                        <Controller
                            name="deal_stage"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} select label="Étape" fullWidth size="small">
                                    {['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'].map((s) => (
                                        <MenuItem key={s} value={s}>{s}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" color="success" disabled={convertLead.isPending}>Convertir</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function LeadsPage() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(25)
    const [createOpen, setCreateOpen] = useState(false)
    const [convertTarget, setConvertTarget] = useState<LeadOut | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<LeadOut | null>(null)

    const deleteLead = useDeleteLead()

    const { data, isLoading } = useLeads({
        search: search || undefined,
        status: statusFilter || undefined,
        page: page + 1,
        page_size: pageSize,
    })

    const columns: ColumnDef<LeadOut>[] = [
        { key: 'name', header: 'Nom', sortable: true },
        { key: 'email', header: 'Email' },
        { key: 'source', header: 'Source' },
        {
            key: 'status',
            header: 'Statut',
            render: (row) => <Chip label={row.status} color={STATUS_COLORS[row.status]} size="small" />,
        },
        {
            key: 'score',
            header: 'Score',
            align: 'center',
            render: (row) => (row.score != null ? String(row.score) : '—'),
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (row) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {row.status !== 'Converti' && (
                        <Tooltip title="Convertir">
                            <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); setConvertTarget(row) }}>
                                <AutorenewIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ]

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" fontWeight={600}>Prospects</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                    Nouveau prospect
                </Button>
            </Stack>

            <Stack direction="row" spacing={2} mb={2}>
                <TextField
                    size="small"
                    placeholder="Rechercher…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    sx={{ flex: 1, maxWidth: 320 }}
                />
                <TextField
                    select
                    size="small"
                    label="Statut"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as LeadStatus | ''); setPage(0) }}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Tous</MenuItem>
                    {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
            </Stack>

            <DataTable
                columns={columns}
                rows={data?.items ?? []}
                total={data?.total ?? 0}
                page={page}
                pageSize={pageSize}
                loading={isLoading}
                onPageChange={setPage}
                onPageSizeChange={(ps) => { setPageSize(ps); setPage(0) }}
                emptyMessage="Aucun prospect"
            />

            <CreateLeadDialog open={createOpen} onClose={() => setCreateOpen(false)} />
            <ConvertLeadDialog lead={convertTarget} open={!!convertTarget} onClose={() => setConvertTarget(null)} />
            <ConfirmDialog
                open={!!deleteTarget}
                title="Supprimer le prospect"
                message={`Voulez-vous supprimer « ${deleteTarget?.name} » ?`}
                confirmLabel="Supprimer"
                danger
                loading={deleteLead.isPending}
                onConfirm={async () => {
                    if (deleteTarget) await deleteLead.mutateAsync(deleteTarget.id)
                    setDeleteTarget(null)
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </Box>
    )
}
