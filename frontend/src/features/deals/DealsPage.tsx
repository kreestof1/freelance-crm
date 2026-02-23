import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Paper,
    Stack,
    TextField,
    Typography,
    alpha,
    useTheme,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
    type DealOut,
    type PipelineStageOut,
    useCreateDeal,
    useDeals,
    useMoveDeal,
    usePipelineStages,
} from '@/api/deals'
import { DealCard } from './DealCard'
import { DealSlideOver } from './DealSlideOver'
import { exportApi } from '@/api/export'
import { useCompanies } from '@/api/companies'

// ── Colonne Kanban droppable ──────────────────────────────────────────────────

interface KanbanColumnProps {
    stage: PipelineStageOut
    deals: DealOut[]
    onCardClick: (deal: DealOut) => void
    onAddClick: (stageName: string) => void
    isOver: boolean
}

function KanbanColumn({ stage, deals, onCardClick, onAddClick, isOver }: KanbanColumnProps) {
    const theme = useTheme()
    const { setNodeRef } = useDroppable({ id: stage.name })

    const totalAmount = deals.reduce((s, d) => s + parseFloat(d.amount), 0)
    const weightedAmount = deals.reduce((s, d) => s + parseFloat(d.weighted_amount), 0)

    const fmt = (n: number) =>
        new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n)

    return (
        <Box sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Paper
                elevation={0}
                sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 2,
                    borderTop: `3px solid ${stage.color ?? theme.palette.grey[400]}`,
                    bgcolor: alpha(stage.color ?? theme.palette.grey[400], 0.08),
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {stage.name}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 10,
                            bgcolor: alpha(stage.color ?? theme.palette.grey[400], 0.18),
                            fontWeight: 700,
                        }}
                    >
                        {deals.length}
                    </Typography>
                </Stack>
                {deals.length > 0 && (
                    <Stack direction="row" spacing={1} mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            {fmt(totalAmount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">•</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={600}>
                            {fmt(weightedAmount)}
                        </Typography>
                    </Stack>
                )}
            </Paper>

            <Box
                ref={setNodeRef}
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    minHeight: 120,
                    p: 0.5,
                    borderRadius: 2,
                    transition: 'background-color 0.15s',
                    bgcolor: isOver
                        ? alpha(stage.color ?? theme.palette.primary.main, 0.1)
                        : 'transparent',
                    border: isOver
                        ? `2px dashed ${stage.color ?? theme.palette.primary.main}`
                        : '2px solid transparent',
                }}
            >
                <Stack spacing={1}>
                    {deals.map((deal) => (
                        <DealCard key={deal.id} deal={deal} onClick={onCardClick} />
                    ))}
                </Stack>
            </Box>

            {!stage.is_closed && (
                <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => onAddClick(stage.name)}
                    sx={{
                        mt: 0.5,
                        justifyContent: 'flex-start',
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    }}
                >
                    Ajouter
                </Button>
            )}
        </Box>
    )
}

// ── Dialog création rapide ────────────────────────────────────────────────────

const createSchema = z.object({
    title: z.string().min(1, 'Titre requis').max(300),
    amount: z.coerce.number().min(0).default(0),
    probability: z.coerce.number().min(0).max(100).default(0),
    company_id: z.string().uuid().nullable().optional(),
})
type CreateForm = z.infer<typeof createSchema>

interface CreateDealDialogProps {
    open: boolean
    stage: string
    defaultProbability: number
    onClose: () => void
}

function CreateDealDialog({ open, stage, defaultProbability, onClose }: CreateDealDialogProps) {
    const createDeal = useCreateDeal()
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []
    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
        defaultValues: { title: '', amount: 0, probability: defaultProbability, company_id: null },
    })
    const companyId = watch('company_id')

    const onSubmit = async (values: CreateForm) => {
        await createDeal.mutateAsync({ ...values, stage, company_id: values.company_id ?? null })
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={() => { reset(); onClose() }} maxWidth="xs" fullWidth>
            <DialogTitle>
                Nouvelle opportunité —{' '}
                <Typography component="span" color="primary" fontWeight={700}>{stage}</Typography>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} mt={1}>
                    <TextField
                        label="Titre *"
                        {...register('title')}
                        error={!!errors.title}
                        helperText={errors.title?.message}
                        autoFocus
                        fullWidth
                    />
                    <Autocomplete
                        options={companies}
                        getOptionLabel={(o) => o.name}
                        value={companies.find((c) => c.id === companyId) ?? null}
                        onChange={(_, v) => setValue('company_id', v?.id ?? null, { shouldDirty: true })}
                        size="small"
                        renderInput={(params) => (
                            <TextField {...params} label="Entreprise (optionnel)" fullWidth />
                        )}
                    />
                    <Stack direction="row" spacing={1.5}>
                        <TextField
                            label="Montant (€)"
                            type="number"
                            {...register('amount')}
                            error={!!errors.amount}
                            helperText={errors.amount?.message}
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label="Proba (%)"
                            type="number"
                            {...register('probability')}
                            error={!!errors.probability}
                            sx={{ width: 100 }}
                            size="small"
                        />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { reset(); onClose() }}>Annuler</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit(onSubmit)}
                    disabled={createDeal.isPending}
                >
                    {createDeal.isPending ? 'Création…' : 'Créer'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function DealsPage() {
    const theme = useTheme()
    const { data: stagesData, isLoading: stagesLoading } = usePipelineStages()
    const { data: dealsData, isLoading: dealsLoading, isError } = useDeals({ page_size: 200 })
    const moveDeal = useMoveDeal()

    const [selectedDeal, setSelectedDeal] = useState<DealOut | null>(null)
    const [slideOverOpen, setSlideOverOpen] = useState(false)
    const [createDialog, setCreateDialog] = useState<{ open: boolean; stage: string; prob: number }>({
        open: false,
        stage: 'Découverte',
        prob: 10,
    })
    const [draggedDeal, setDraggedDeal] = useState<DealOut | null>(null)
    const [overStage, setOverStage] = useState<string | null>(null)

    const dealsByStage = useMemo<Record<string, DealOut[]>>(() => {
        const map: Record<string, DealOut[]> = {}
        for (const s of stagesData ?? []) map[s.name] = []
        for (const d of dealsData?.items ?? []) {
            if (!map[d.stage]) map[d.stage] = []
            map[d.stage].push(d)
        }
        return map
    }, [dealsData, stagesData])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const deal = dealsData?.items.find((d) => d.id === event.active.id)
        setDraggedDeal(deal ?? null)
    }, [dealsData])

    const handleDragOver = useCallback((event: DragOverEvent) => {
        setOverStage(event.over ? String(event.over.id) : null)
    }, [])

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setDraggedDeal(null)
        setOverStage(null)
        const { active, over } = event
        if (!over) return
        const dealId = String(active.id)
        const newStage = String(over.id)
        const deal = dealsData?.items.find((d) => d.id === dealId)
        if (!deal || deal.stage === newStage) return
        await moveDeal.mutateAsync({ id: dealId, stage: newStage })
    }, [dealsData, moveDeal])

    if (stagesLoading || dealsLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
                <CircularProgress />
            </Box>
        )
    }

    if (isError) {
        return <Alert severity="error">Erreur lors du chargement des opportunités.</Alert>
    }

    const stages = stagesData ?? []
    const totalDeals = dealsData?.total ?? 0
    const totalAmount = dealsData?.items.reduce((s, d) => s + parseFloat(d.amount), 0) ?? 0
    const totalWeighted = dealsData?.items.reduce((s, d) => s + parseFloat(d.weighted_amount), 0) ?? 0

    const fmtCompact = (n: number) =>
        new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            notation: 'compact',
            compactDisplay: 'short',
        }).format(n)

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Barre de titre */}
            <Box sx={{ px: 3, pt: 2, pb: 1.5, flexShrink: 0 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Pipeline Opportunités</Typography>
                        <Stack direction="row" spacing={2} mt={0.5} divider={<Divider orientation="vertical" flexItem />}>
                            <Typography variant="body2" color="text.secondary">
                                <strong>{totalDeals}</strong> deal{totalDeals > 1 ? 's' : ''}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Total <strong>{fmtCompact(totalAmount)}</strong>
                            </Typography>
                            <Typography variant="body2" color="primary.main">
                                Pondéré <strong>{fmtCompact(totalWeighted)}</strong>
                            </Typography>
                        </Stack>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialog({ open: true, stage: 'Découverte', prob: 10 })}
                        size="small"
                    >
                        Nouvelle opportunité
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => exportApi.deals()}
                        size="small"
                    >
                        Export CSV
                    </Button>
                </Stack>
            </Box>

            <Divider />

            {/* Board Kanban */}
            <Box sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ height: '100%', p: 2, minWidth: `${stages.length * 296}px` }}
                    >
                        {stages.map((stage) => (
                            <KanbanColumn
                                key={stage.id}
                                stage={stage}
                                deals={dealsByStage[stage.name] ?? []}
                                onCardClick={(d) => { setSelectedDeal(d); setSlideOverOpen(true) }}
                                onAddClick={(s) => {
                                    const st = stagesData?.find((x) => x.name === s)
                                    setCreateDialog({ open: true, stage: s, prob: st?.default_probability ?? 0 })
                                }}
                                isOver={overStage === stage.name}
                            />
                        ))}
                    </Stack>

                    <DragOverlay>
                        {draggedDeal && (
                            <Box sx={{ transform: 'rotate(2deg)', opacity: 0.9 }}>
                                <DealCard deal={draggedDeal} onClick={() => {}} isDragging />
                            </Box>
                        )}
                    </DragOverlay>
                </DndContext>
            </Box>

            <DealSlideOver
                deal={selectedDeal}
                stages={stages}
                open={slideOverOpen}
                onClose={() => setSlideOverOpen(false)}
                onDeleted={() => setSelectedDeal(null)}
            />

            <CreateDealDialog
                open={createDialog.open}
                stage={createDialog.stage}
                defaultProbability={createDialog.prob}
                onClose={() => setCreateDialog((d) => ({ ...d, open: false }))}
            />
        </Box>
    )
}
