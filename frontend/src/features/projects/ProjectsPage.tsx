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
    LinearProgress,
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DownloadIcon from '@mui/icons-material/Download'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { exportApi } from '@/api/export'
import {
    useProjects,
    useCreateProject,
    usePatchProject,
    useDeleteProject,
    type ProjectOut,
    type ProjectStatus,
} from '@/api/projects'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ProjectStatus[] = ['Planifié', 'En cours', 'Suspendu', 'Clôturé']

const STATUS_COLORS: Record<ProjectStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    'Planifié': 'info',
    'En cours': 'success',
    'Suspendu': 'warning',
    'Clôturé': 'default',
}

// ── Schema ────────────────────────────────────────────────────────────────────

const createSchema = z.object({
    title: z.string().min(1, 'Requis').max(300),
    status: z.enum(['Planifié', 'En cours', 'Suspendu', 'Clôturé']).default('Planifié'),
    rate_type: z.enum(['tjm', 'forfait']).default('tjm'),
    rate_value: z.string().optional(),
    budget_amount: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

const editSchema = z.object({
    title: z.string().min(1, 'Requis').max(300),
    status: z.enum(['Planifié', 'En cours', 'Suspendu', 'Clôturé']),
    rate_type: z.enum(['tjm', 'forfait']),
    rate_value: z.string().optional(),
    budget_amount: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    notes: z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

// ── Edit Project Dialog ───────────────────────────────────────────────────────

interface EditProjectDialogProps {
    project: ProjectOut | null
    onClose: () => void
    onSave: (values: EditForm) => Promise<void>
    isPending: boolean
}

function EditProjectDialog({ project, onClose, onSave, isPending }: EditProjectDialogProps) {
    const { t } = useTranslation()
    const { control, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
        resolver: zodResolver(editSchema),
    })

    React.useEffect(() => {
        if (project) {
            reset({
                title: project.title,
                status: project.status,
                rate_type: project.rate_type,
                rate_value: project.rate_value ? String(project.rate_value) : '',
                budget_amount: project.budget_amount ? String(project.budget_amount) : '',
                start_date: project.start_date ?? '',
                end_date: project.end_date ?? '',
                notes: project.notes ?? '',
            })
        }
    }, [project, reset])

    return (
        <Dialog open={!!project} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit(onSave)} noValidate>
                <DialogTitle>Modifier la mission</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} pt={1}>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label={t('projects.titleLabel')}
                                    error={!!errors.title}
                                    helperText={errors.title?.message}
                                    required
                                    fullWidth
                                />
                            )}
                        />
                        <Stack direction="row" spacing={2}>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <TextField select {...field} label={t('projects.statusLabel')} fullWidth>
                                        {STATUS_OPTIONS.map((s) => (
                                            <MenuItem key={s} value={s}>{s}</MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                            <Controller
                                name="rate_type"
                                control={control}
                                render={({ field }) => (
                                    <TextField select {...field} label={t('projects.rateTypeLabel')} fullWidth>
                                        <MenuItem value="tjm">TJM (€/jour)</MenuItem>
                                        <MenuItem value="forfait">Forfait</MenuItem>
                                    </TextField>
                                )}
                            />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <Controller
                                name="rate_value"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={t('projects.rateValueLabel')}
                                        type="number"
                                        inputProps={{ min: 0 }}
                                        fullWidth
                                    />
                                )}
                            />
                            <Controller
                                name="budget_amount"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={t('projects.budgetAmountLabel')}
                                        type="number"
                                        inputProps={{ min: 0 }}
                                        fullWidth
                                    />
                                )}
                            />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <Controller
                                name="start_date"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={t('projects.startDateLabel')}
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                    />
                                )}
                            />
                            <Controller
                                name="end_date"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={t('projects.endDateLabel')}
                                        type="date"
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                    />
                                )}
                            />
                        </Stack>
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} label={t('projects.notesLabel')} multiline rows={3} fullWidth />
                            )}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="submit" variant="contained" disabled={isPending}>
                        {isPending ? 'Enregistrement…' : t('common.save', 'Enregistrer')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectsPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [createOpen, setCreateOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<ProjectOut | null>(null)
    const [editTarget, setEditTarget] = useState<ProjectOut | null>(null)

    const { data, isLoading } = useProjects({ status: statusFilter || undefined })
    const createProject = useCreateProject()
    const patchProject = usePatchProject()
    const deleteProject = useDeleteProject()

    const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            status: 'Planifié',
            rate_type: 'tjm',
            title: '',
            rate_value: '',
            budget_amount: '',
            start_date: '',
            end_date: '',
            notes: '',
        },
    })

    const filtered = (data?.items ?? []).filter((p) =>
        !search || p.title.toLowerCase().includes(search.toLowerCase())
    )

    const columns: ColumnDef<ProjectOut>[] = [
        {
            key: 'title',
            label: t('projects.titleLabel'),
            render: (row) => (
                <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => navigate(`/projects/${row.id}`)}
                >
                    {row.title}
                </Typography>
            ),
        },
        {
            key: 'status',
            label: t('projects.statusLabel'),
            render: (row) => (
                <Chip
                    label={row.status}
                    size="small"
                    color={STATUS_COLORS[row.status] ?? 'default'}
                />
            ),
        },
        {
            key: 'milestones',
            label: t('projects.milestonesLabel'),
            render: (row) => (
                <Box sx={{ minWidth: 100 }}>
                    <Typography variant="caption" color="text.secondary">
                        {row.milestones_done}/{row.milestones_total}
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={
                            row.milestones_total > 0
                                ? (row.milestones_done / row.milestones_total) * 100
                                : 0
                        }
                        sx={{ mt: 0.5, borderRadius: 1, height: 6 }}
                        color={
                            row.milestones_done === row.milestones_total && row.milestones_total > 0
                                ? 'success'
                                : 'primary'
                        }
                    />
                </Box>
            ),
        },
        {
            key: 'rate',
            label: t('projects.rateLabel'),
            render: (row) => (
                <Typography variant="body2">
                    {row.rate_type === 'tjm'
                        ? `${Number(row.rate_value).toLocaleString('fr-FR')} €/j`
                        : `${Number(row.budget_amount ?? 0).toLocaleString('fr-FR')} € forfait`}
                </Typography>
            ),
        },
        {
            key: 'company',
            label: t('projects.companyLabel'),
            render: (row) => (
                <Typography variant="body2" color="text.secondary">
                    {row.company_name ?? '—'}
                </Typography>
            ),
        },
        {
            key: 'upcoming',
            label: t('projects.upcomingLabel'),
            render: (row) =>
                row.upcoming_milestones.length > 0 ? (
                    <Chip
                        label={row.upcoming_milestones[0].name}
                        size="small"
                        color="warning"
                        variant="outlined"
                    />
                ) : null,
        },
        {
            key: 'actions',
            label: '',
            render: (row) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditTarget(row) }}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Ouvrir">
                        <IconButton size="small" onClick={() => navigate(`/projects/${row.id}`)}>
                            <OpenInNewIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(row)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ]

    const onSubmit = handleSubmit(async (values) => {
        await createProject.mutateAsync({
            title: values.title,
            status: values.status,
            rate_type: values.rate_type,
            rate_value: values.rate_value || '0',
            budget_amount: values.budget_amount || null,
            start_date: values.start_date || null,
            end_date: values.end_date || null,
            notes: values.notes || null,
        })
        reset()
        setCreateOpen(false)
    })

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700}>
                    {t('projects.title')}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportApi.projects()}
                        size="small"
                    >
                        Export CSV
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                        {t('projects.new')}
                    </Button>
                </Stack>
            </Stack>

            {/* Filtres */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
                <TextField
                    size="small"
                    placeholder={t('common.search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: 220 }}
                />
                <TextField
                    select
                    size="small"
                    label={t('projects.statusLabel')}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={{ minWidth: 160 }}
                >
                    <MenuItem value="">Tous</MenuItem>
                    {STATUS_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>
                            {s}
                        </MenuItem>
                    ))}
                </TextField>
            </Stack>

            <DataTable columns={columns} rows={filtered} loading={isLoading} />

            {/* Dialog création */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <form onSubmit={onSubmit} noValidate>
                    <DialogTitle>{t('projects.new')}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} pt={1}>
                            <Controller
                                name="title"
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={t('projects.titleLabel')}
                                        error={!!errors.title}
                                        helperText={errors.title?.message}
                                        required
                                        fullWidth
                                    />
                                )}
                            />
                            <Stack direction="row" spacing={2}>
                                <Controller
                                    name="status"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField select {...field} label={t('projects.statusLabel')} fullWidth>
                                            {STATUS_OPTIONS.map((s) => (
                                                <MenuItem key={s} value={s}>{s}</MenuItem>
                                            ))}
                                        </TextField>
                                    )}
                                />
                                <Controller
                                    name="rate_type"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField select {...field} label={t('projects.rateTypeLabel')} fullWidth>
                                            <MenuItem value="tjm">TJM (€/jour)</MenuItem>
                                            <MenuItem value="forfait">Forfait</MenuItem>
                                        </TextField>
                                    )}
                                />
                            </Stack>
                            <Stack direction="row" spacing={2}>
                                <Controller
                                    name="rate_value"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label={t('projects.rateValueLabel')}
                                            type="number"
                                            inputProps={{ min: 0 }}
                                            fullWidth
                                        />
                                    )}
                                />
                                <Controller
                                    name="budget_amount"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label={t('projects.budgetAmountLabel')}
                                            type="number"
                                            inputProps={{ min: 0 }}
                                            fullWidth
                                        />
                                    )}
                                />
                            </Stack>
                            <Stack direction="row" spacing={2}>
                                <Controller
                                    name="start_date"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label={t('projects.startDateLabel')}
                                            type="date"
                                            InputLabelProps={{ shrink: true }}
                                            fullWidth
                                        />
                                    )}
                                />
                                <Controller
                                    name="end_date"
                                    control={control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label={t('projects.endDateLabel')}
                                            type="date"
                                            InputLabelProps={{ shrink: true }}
                                            fullWidth
                                        />
                                    )}
                                />
                            </Stack>
                            <Controller
                                name="notes"
                                control={control}
                                render={({ field }) => (
                                    <TextField {...field} label={t('projects.notesLabel')} multiline rows={2} fullWidth />
                                )}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setCreateOpen(false)
                                reset()
                            }}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" variant="contained" disabled={createProject.isPending}>
                            {t('common.create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Confirm delete */}
            <ConfirmDialog
                open={!!deleteTarget}
                title={t('projects.deleteConfirm')}
                message={`Supprimer la mission "${deleteTarget?.title}" ?`}
                danger
                onConfirm={async () => {
                    if (deleteTarget) await deleteProject.mutateAsync(deleteTarget.id)
                    setDeleteTarget(null)
                }}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* Dialog édition */}
            <EditProjectDialog
                project={editTarget}
                onClose={() => setEditTarget(null)}
                onSave={async (values) => {
                    if (!editTarget) return
                    await patchProject.mutateAsync({
                        id: editTarget.id,
                        data: {
                            title: values.title,
                            status: values.status,
                            rate_type: values.rate_type,
                            rate_value: values.rate_value || '0',
                            budget_amount: values.budget_amount || null,
                            start_date: values.start_date || null,
                            end_date: values.end_date || null,
                            notes: values.notes || null,
                        },
                    })
                    setEditTarget(null)
                }}
                isPending={patchProject.isPending}
            />
        </Box>
    )
}
