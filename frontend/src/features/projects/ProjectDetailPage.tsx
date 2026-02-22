import React, { useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Link,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Skeleton,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO, isWithinInterval, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
    useProject,
    usePatchProject,
    useDeleteProject,
    useAddMilestone,
    usePatchMilestone,
    useDeleteMilestone,
    type MilestoneOut,
    type ProjectStatus,
} from '@/api/projects'
import { useDocuments, useUploadDocument, useDeleteDocument, type DocumentType } from '@/api/documents'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ProjectStatus[] = ['Planifié', 'En cours', 'Suspendu', 'Clôturé']
const DOC_TYPES: DocumentType[] = ['Brief', 'Proposition', 'Contrat', 'Autre']

const MILESTONE_ICON: Record<string, React.ReactNode> = {
    Done: <CheckCircleIcon color="success" fontSize="small" />,
    Pending: <RadioButtonUncheckedIcon color="action" fontSize="small" />,
    Delayed: <WarningAmberIcon color="warning" fontSize="small" />,
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const milestoneSchema = z.object({
    name: z.string().min(1, 'Requis').max(200),
    due_date: z.string().optional(),
    amount: z.string().optional(),
    status: z.enum(['Pending', 'Done', 'Delayed']).default('Pending'),
})
type MilestoneForm = z.infer<typeof milestoneSchema>

const docLinkSchema = z.object({
    type: z.enum(['Brief', 'Proposition', 'Contrat', 'Autre']).default('Autre'),
    external_url: z.string().url('URL invalide').min(1, 'Requis'),
})
type DocLinkForm = z.infer<typeof docLinkSchema>

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectDetailPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()

    const { data: project, isLoading } = useProject(id)
    const { data: docsData } = useDocuments('project', id)

    const patchProject = usePatchProject()
    const deleteProject = useDeleteProject()
    const addMilestone = useAddMilestone(id ?? '')
    const patchMilestone = usePatchMilestone(id ?? '')
    const deleteMilestone = useDeleteMilestone(id ?? '')
    const uploadDoc = useUploadDocument()
    const deleteDoc = useDeleteDocument()

    const [milestoneOpen, setMilestoneOpen] = useState(false)
    const [editMilestone, setEditMilestone] = useState<MilestoneOut | null>(null)
    const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<MilestoneOut | null>(null)
    const [docLinkOpen, setDocLinkOpen] = useState(false)
    const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null)
    const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const milestoneForm = useForm<MilestoneForm>({
        resolver: zodResolver(milestoneSchema),
        defaultValues: { status: 'Pending' },
    })

    const docLinkForm = useForm<DocLinkForm>({
        resolver: zodResolver(docLinkSchema),
        defaultValues: { type: 'Autre' },
    })

    if (isLoading) {
        return (
            <Box>
                <Skeleton variant="rectangular" height={80} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={200} />
            </Box>
        )
    }

    if (!project) {
        return <Alert severity="error">Mission introuvable.</Alert>
    }

    const today = new Date()
    const isUpcoming = (m: MilestoneOut) => {
        if (!m.due_date || m.status === 'Done') return false
        const d = parseISO(m.due_date)
        return isWithinInterval(d, { start: today, end: addDays(today, 7) })
    }

    // Milestone submit
    const onMilestoneSubmit = milestoneForm.handleSubmit(async (values) => {
        const payload = {
            name: values.name,
            due_date: values.due_date || null,
            amount: values.amount ? values.amount : null,
            status: values.status,
        }
        if (editMilestone) {
            await patchMilestone.mutateAsync({ milestoneId: editMilestone.id, data: payload })
        } else {
            await addMilestone.mutateAsync(payload)
        }
        milestoneForm.reset()
        setMilestoneOpen(false)
        setEditMilestone(null)
    })

    const openEditMilestone = (m: MilestoneOut) => {
        setEditMilestone(m)
        milestoneForm.reset({
            name: m.name,
            due_date: m.due_date ?? '',
            amount: m.amount?.toString() ?? '',
            status: m.status,
        })
        setMilestoneOpen(true)
    }

    // Doc link submit
    const onDocLinkSubmit = docLinkForm.handleSubmit(async (values) => {
        if (!id) return
        await uploadDoc.mutateAsync({
            type: values.type,
            relatedType: 'project',
            relatedId: id,
            externalUrl: values.external_url,
        })
        docLinkForm.reset()
        setDocLinkOpen(false)
    })

    // File upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !id) return
        await uploadDoc.mutateAsync({
            file,
            type: 'Autre',
            relatedType: 'project',
            relatedId: id,
        })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const docs = docsData?.items ?? []
    const milestones = project.milestones ?? []

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                <IconButton onClick={() => navigate('/projects')} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" fontWeight={700} flex={1}>
                    {project.title}
                </Typography>
                <TextField
                    select
                    size="small"
                    value={project.status}
                    onChange={(e) =>
                        patchProject.mutate({ id: project.id, data: { status: e.target.value as ProjectStatus } })
                    }
                    sx={{ minWidth: 140 }}
                >
                    {STATUS_OPTIONS.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                </TextField>
                <Tooltip title="Supprimer la mission">
                    <IconButton color="error" onClick={() => setDeleteProjectConfirm(true)}>
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Grid container spacing={3}>
                {/* Colonne gauche : infos + jalons */}
                <Grid item xs={12} md={7}>
                    {/* Infos générale */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                        <Typography variant="subtitle1" fontWeight={600} mb={1}>
                            {t('projects.infoTitle', 'Informations')}
                        </Typography>
                        <Grid container spacing={1}>
                            {project.company_name && (
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Entreprise</Typography>
                                    <Typography variant="body2">{project.company_name}</Typography>
                                </Grid>
                            )}
                            {project.contact_name && (
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Contact</Typography>
                                    <Typography variant="body2">{project.contact_name}</Typography>
                                </Grid>
                            )}
                            {project.deal_title && (
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Deal d'origine</Typography>
                                    <Typography variant="body2">{project.deal_title}</Typography>
                                </Grid>
                            )}
                            <Grid item xs={6}>
                                <Typography variant="caption" color="text.secondary">Type de facturation</Typography>
                                <Typography variant="body2">
                                    {project.rate_type === 'tjm'
                                        ? `TJM : ${Number(project.rate_value).toLocaleString('fr-FR')} €/j`
                                        : `Forfait : ${Number(project.budget_amount ?? 0).toLocaleString('fr-FR')} €`}
                                </Typography>
                            </Grid>
                            {project.start_date && (
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Début</Typography>
                                    <Typography variant="body2">
                                        {format(parseISO(project.start_date), 'dd MMM yyyy', { locale: fr })}
                                    </Typography>
                                </Grid>
                            )}
                            {project.end_date && (
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary">Fin prévue</Typography>
                                    <Typography variant="body2">
                                        {format(parseISO(project.end_date), 'dd MMM yyyy', { locale: fr })}
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>
                        {project.notes && (
                            <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography variant="body2" color="text.secondary" whiteSpace="pre-line">
                                    {project.notes}
                                </Typography>
                            </>
                        )}
                    </Paper>

                    {/* Jalons */}
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Jalons ({project.milestones_done}/{project.milestones_total})
                            </Typography>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => {
                                    setEditMilestone(null)
                                    milestoneForm.reset({ status: 'Pending' })
                                    setMilestoneOpen(true)
                                }}
                            >
                                Ajouter
                            </Button>
                        </Stack>

                        {milestones.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                Aucun jalon défini
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {milestones.map((m, idx) => (
                                    <React.Fragment key={m.id}>
                                        {idx > 0 && <Divider component="li" />}
                                        <ListItem
                                            secondaryAction={
                                                <Stack direction="row" spacing={0.5}>
                                                    <IconButton size="small" onClick={() => openEditMilestone(m)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setDeleteMilestoneTarget(m)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            }
                                            sx={{
                                                bgcolor: isUpcoming(m) ? 'warning.light' : 'transparent',
                                                borderRadius: 1,
                                                '& .MuiListItemSecondaryAction-root': { right: 0 },
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 32 }}>
                                                {MILESTONE_ICON[m.status] ?? MILESTONE_ICON.Pending}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <span>{m.name}</span>
                                                        {isUpcoming(m) && (
                                                            <Chip label="J-7" size="small" color="warning" />
                                                        )}
                                                    </Stack>
                                                }
                                                secondary={
                                                    <Stack direction="row" spacing={1}>
                                                        {m.due_date && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {format(parseISO(m.due_date), 'dd MMM yyyy', { locale: fr })}
                                                            </Typography>
                                                        )}
                                                        {m.amount && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {Number(m.amount).toLocaleString('fr-FR')} €
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                }
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Grid>

                {/* Colonne droite : Documents */}
                <Grid item xs={12} md={5}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Documents ({docs.length})
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Lien externe (Drive, OneDrive…)">
                                    <IconButton size="small" onClick={() => setDocLinkOpen(true)}>
                                        <LinkIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Uploader un fichier">
                                    <IconButton
                                        size="small"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadDoc.isPending}
                                    >
                                        <AttachFileIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    hidden
                                    onChange={handleFileUpload}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                                />
                            </Stack>
                        </Stack>

                        {uploadDoc.isPending && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', mb: 1 }} />}

                        {docs.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                                Aucun document
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {docs.map((doc, idx) => (
                                    <React.Fragment key={doc.id}>
                                        {idx > 0 && <Divider component="li" />}
                                        <ListItem
                                            secondaryAction={
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => setDeleteDocTarget(doc.id)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemIcon sx={{ minWidth: 32 }}>
                                                <AttachFileIcon fontSize="small" color="action" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                                                            {doc.filename}
                                                        </Typography>
                                                        <Chip label={doc.type} size="small" variant="outlined" />
                                                    </Stack>
                                                }
                                                secondary={
                                                    doc.external_url ? (
                                                        <Link
                                                            href={doc.external_url}
                                                            target="_blank"
                                                            rel="noopener"
                                                            variant="caption"
                                                            underline="hover"
                                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}
                                                        >
                                                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                                                            Ouvrir
                                                        </Link>
                                                    ) : doc.signed_url ? (
                                                        <Link
                                                            href={doc.signed_url}
                                                            target="_blank"
                                                            rel="noopener"
                                                            variant="caption"
                                                            underline="hover"
                                                        >
                                                            Télécharger
                                                        </Link>
                                                    ) : null
                                                }
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Dialog jalon */}
            <Dialog
                open={milestoneOpen}
                onClose={() => {
                    setMilestoneOpen(false)
                    setEditMilestone(null)
                }}
                maxWidth="xs"
                fullWidth
            >
                <form onSubmit={onMilestoneSubmit} noValidate>
                    <DialogTitle>{editMilestone ? 'Modifier le jalon' : 'Ajouter un jalon'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} pt={1}>
                            <Controller
                                name="name"
                                control={milestoneForm.control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="Nom du jalon"
                                        error={!!milestoneForm.formState.errors.name}
                                        helperText={milestoneForm.formState.errors.name?.message}
                                        required
                                        fullWidth
                                    />
                                )}
                            />
                            <Stack direction="row" spacing={2}>
                                <Controller
                                    name="due_date"
                                    control={milestoneForm.control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Date cible"
                                            type="date"
                                            InputLabelProps={{ shrink: true }}
                                            fullWidth
                                        />
                                    )}
                                />
                                <Controller
                                    name="amount"
                                    control={milestoneForm.control}
                                    render={({ field }) => (
                                        <TextField
                                            {...field}
                                            label="Montant (€)"
                                            type="number"
                                            inputProps={{ min: 0 }}
                                            fullWidth
                                        />
                                    )}
                                />
                            </Stack>
                            <Controller
                                name="status"
                                control={milestoneForm.control}
                                render={({ field }) => (
                                    <TextField select {...field} label="Statut" fullWidth>
                                        <MenuItem value="Pending">En attente</MenuItem>
                                        <MenuItem value="Done">Terminé</MenuItem>
                                        <MenuItem value="Delayed">Retardé</MenuItem>
                                    </TextField>
                                )}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setMilestoneOpen(false)
                                setEditMilestone(null)
                            }}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addMilestone.isPending || patchMilestone.isPending}
                        >
                            {editMilestone ? 'Mettre à jour' : 'Ajouter'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Dialog lien externe */}
            <Dialog open={docLinkOpen} onClose={() => setDocLinkOpen(false)} maxWidth="xs" fullWidth>
                <form onSubmit={onDocLinkSubmit} noValidate>
                    <DialogTitle>Ajouter un lien externe</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} pt={1}>
                            <Controller
                                name="type"
                                control={docLinkForm.control}
                                render={({ field }) => (
                                    <TextField select {...field} label="Type de document" fullWidth>
                                        {DOC_TYPES.map((dt) => (
                                            <MenuItem key={dt} value={dt}>{dt}</MenuItem>
                                        ))}
                                    </TextField>
                                )}
                            />
                            <Controller
                                name="external_url"
                                control={docLinkForm.control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label="URL (Google Drive, OneDrive…)"
                                        error={!!docLinkForm.formState.errors.external_url}
                                        helperText={docLinkForm.formState.errors.external_url?.message}
                                        placeholder="https://docs.google.com/..."
                                        fullWidth
                                    />
                                )}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDocLinkOpen(false)}>Annuler</Button>
                        <Button type="submit" variant="contained" disabled={uploadDoc.isPending}>
                            Ajouter
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Confirm delete milestone */}
            <ConfirmDialog
                open={!!deleteMilestoneTarget}
                title="Supprimer le jalon"
                message={`Supprimer le jalon "${deleteMilestoneTarget?.name}" ?`}
                danger
                onConfirm={async () => {
                    if (deleteMilestoneTarget) {
                        await deleteMilestone.mutateAsync(deleteMilestoneTarget.id)
                    }
                    setDeleteMilestoneTarget(null)
                }}
                onCancel={() => setDeleteMilestoneTarget(null)}
            />

            {/* Confirm delete document */}
            <ConfirmDialog
                open={!!deleteDocTarget}
                title="Supprimer le document"
                message="Supprimer ce document ?"
                danger
                onConfirm={async () => {
                    if (deleteDocTarget) await deleteDoc.mutateAsync(deleteDocTarget)
                    setDeleteDocTarget(null)
                }}
                onCancel={() => setDeleteDocTarget(null)}
            />

            {/* Confirm delete project */}
            <ConfirmDialog
                open={deleteProjectConfirm}
                title="Supprimer la mission"
                message={`Supprimer définitivement la mission "${project.title}" ?`}
                danger
                onConfirm={async () => {
                    await deleteProject.mutateAsync(project.id)
                    navigate('/projects')
                }}
                onCancel={() => setDeleteProjectConfirm(false)}
            />
        </Box>
    )
}
