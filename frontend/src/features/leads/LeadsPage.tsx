import React, { useState } from 'react'
import {
    Autocomplete,
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
import EditIcon from '@mui/icons-material/Edit'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagsInput } from '@/components/common/TagsInput'
import { useCompanies } from '@/api/companies'
import {
    useLeads,
    useCreateLead,
    usePatchLead,
    useDeleteLead,
    useConvertLead,
    type LeadOut,
    type LeadStatus,
    type LeadSource,
} from '@/api/leads'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: LeadStatus[] = ['Nouveau', 'Qualifié', 'Converti', 'Perdu']
const SOURCE_OPTIONS: LeadSource[] = ['web', 'recommandation', 'evenement', 'réseau', 'publicité', 'other']

const SOURCE_LABELS: Record<LeadSource, string> = {
    web: 'Web',
    recommandation: 'Recommandation',
    evenement: 'Événement',
    réseau: 'Réseau',
    publicité: 'Publicité',
    other: 'Autre',
}

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
    source: z.enum(['web', 'recommandation', 'evenement', 'réseau', 'publicité', 'other']),
    status: z.enum(['Nouveau', 'Qualifié', 'Converti', 'Perdu']).optional(),
    score: z.number().min(0).max(100).optional().nullable(),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
    company_id: z.string().uuid().nullable().optional(),
})

const convertSchema = z.object({
    deal_title: z.string().min(1, 'Requis'),
    deal_amount: z.coerce.number().min(0).optional(),
    deal_stage: z.string().optional(),
    create_contact: z.boolean().default(true),
})

type LeadForm = z.infer<typeof createLeadSchema>
type ConvertForm = z.infer<typeof convertSchema>

// ── Create Lead Dialog ────────────────────────────────────────────────────────

function CreateLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createLead = useCreateLead()
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []

    const { control, handleSubmit, reset, setValue, watch } = useForm<LeadForm>({
        resolver: zodResolver(createLeadSchema),
        defaultValues: { source: 'web', tags: [], company_id: null },
    })
    const tags = watch('tags')
    const company_id = watch('company_id')

    const onSubmit = async (data: LeadForm) => {
        await createLead.mutateAsync({ ...data, email: data.email || undefined, company_id: data.company_id ?? undefined })
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
                                        <MenuItem key={s} value={s}>{SOURCE_LABELS[s]}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />
                        <Autocomplete
                            options={companies}
                            getOptionLabel={(o) => o.name}
                            value={companies.find((c) => c.id === company_id) ?? null}
                            onChange={(_e, val) => setValue('company_id', val?.id ?? null)}
                            renderInput={(params) => (
                                <TextField {...params} label="Entreprise (optionnel)" size="small" />
                            )}
                            isOptionEqualToValue={(o, v) => o.id === v.id}
                            clearOnEscape
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

// ── Edit Lead Dialog ─────────────────────────────────────────────────────────

const editLeadSchema = z.object({
    name: z.string().min(1, 'Requis'),
    email: z.union([z.string().email('Email invalide'), z.literal(''), z.null()]).optional(),
    phone: z.string().optional().nullable(),
    source: z.enum(['web', 'recommandation', 'evenement', 'réseau', 'publicité', 'other']),
    status: z.enum(['Nouveau', 'Qualifié', 'Converti', 'Perdu']),
    score: z.number().min(0).max(100).nullable().optional(),
    notes: z.string().optional().nullable(),
    tags: z.array(z.string()).default([]),
    company_id: z.string().uuid().nullable().optional(),
})

type EditLeadForm = z.infer<typeof editLeadSchema>

function EditLeadDialog({ lead, onClose }: { lead: LeadOut | null; onClose: () => void }) {
    const patchLead = usePatchLead()
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []

    const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EditLeadForm>({
        resolver: zodResolver(editLeadSchema),
    })
    const tags = watch('tags') ?? []
    const company_id = watch('company_id')

    React.useEffect(() => {
        if (lead) {
            reset({
                name: lead.name,
                email: lead.email ?? '',
                phone: lead.phone ?? '',
                source: lead.source,
                status: lead.status,
                score: lead.score ?? null,
                notes: lead.notes ?? '',
                tags: lead.tags ?? [],
                company_id: lead.company_id ?? null,
            })
        }
    }, [lead, reset])

    const onSubmit = async (data: EditLeadForm) => {
        if (!lead) return
        try {
            await patchLead.mutateAsync({
                id: lead.id,
                data: {
                    name: data.name,
                    email: data.email || null,
                    phone: data.phone || null,
                    source: data.source,
                    status: data.status,
                    score: data.score ?? null,
                    notes: data.notes || null,
                    tags: data.tags,
                    company_id: data.company_id ?? null,
                },
            })
            onClose()
        } catch (_e) {
            // error handled by mutation state
        }
    }

    return (
        <Dialog open={!!lead} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Modifier le prospect</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Controller name="name" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} label="Nom *" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} value={field.value ?? ''} label="Email" type="email" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <Controller name="phone" control={control} render={({ field }) => (
                            <TextField {...field} value={field.value ?? ''} label="Téléphone" fullWidth size="small" />
                        )} />
                        <Stack direction="row" spacing={2}>
                            <Controller name="source" control={control} render={({ field }) => (
                                <TextField {...field} select label="Source *" fullWidth size="small">
                                    {SOURCE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{SOURCE_LABELS[s]}</MenuItem>)}
                                </TextField>
                            )} />
                            <Controller name="status" control={control} render={({ field }) => (
                                <TextField {...field} select label="Statut" fullWidth size="small">
                                    {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                </TextField>
                            )} />
                        </Stack>
                        <Controller name="score" control={control} render={({ field }) => (
                            <TextField
                                label="Score (0-100)"
                                type="number"
                                fullWidth
                                size="small"
                                inputProps={{ min: 0, max: 100 }}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                            />
                        )} />
                        <Autocomplete
                            options={companies}
                            getOptionLabel={(o) => o.name}
                            value={companies.find((c) => c.id === company_id) ?? null}
                            onChange={(_e, val) => setValue('company_id', val?.id ?? null)}
                            renderInput={(params) => (
                                <TextField {...params} label="Entreprise (optionnel)" size="small" />
                            )}
                            isOptionEqualToValue={(o, v) => o.id === v.id}
                            clearOnEscape
                        />
                        <TagsInput value={tags} onChange={(t) => setValue('tags', t)} />
                        <Controller name="notes" control={control} render={({ field }) => (
                            <TextField {...field} value={field.value ?? ''} label="Notes" multiline rows={3} fullWidth size="small" />
                        )} />
                        {Object.keys(errors).length > 0 && (
                            <Typography variant="caption" color="error">
                                {Object.entries(errors).map(([k, v]) => `${k}: ${(v as { message?: string })?.message ?? 'invalide'}`).join(', ')}
                            </Typography>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" disabled={patchLead.isPending}>
                        {patchLead.isPending ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
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
    const [editTarget, setEditTarget] = useState<LeadOut | null>(null)
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
        { key: 'company_name', header: 'Entreprise', render: (row) => row.company_name ?? '—' },
        { key: 'source', header: 'Source', render: (row) => SOURCE_LABELS[row.source as LeadSource] ?? row.source },
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
                    <Tooltip title="Modifier">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditTarget(row) }}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
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
            <EditLeadDialog lead={editTarget} onClose={() => setEditTarget(null)} />
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
