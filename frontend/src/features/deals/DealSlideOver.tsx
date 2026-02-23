import { zodResolver } from '@hookform/resolvers/zod'
import BusinessIcon from '@mui/icons-material/Business'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import LockIcon from '@mui/icons-material/Lock'
import SaveIcon from '@mui/icons-material/Save'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    Divider,
    Drawer,
    FormControl,
    FormHelperText,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    Slider,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { type DealOut, type PipelineStageOut, useDeleteDeal, usePatchDeal } from '@/api/deals'
import { type CompanyOut, useCompanies } from '@/api/companies'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagsInput } from '@/components/common/TagsInput'
import { useState } from 'react'

// ── Schéma de validation ──────────────────────────────────────────────────────

const schema = z.object({
    title: z.string().min(1, 'Titre requis').max(300),
    amount: z.coerce.number().min(0),
    currency: z.string().default('EUR'),
    probability: z.coerce.number().min(0).max(100),
    stage: z.string().min(1),
    expected_close: z.string().nullable().optional(),
    origin: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    company_id: z.string().uuid().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface DealSlideOverProps {
    deal: DealOut | null
    stages: PipelineStageOut[]
    open: boolean
    onClose: () => void
    onDeleted?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(v: string | number): string {
    const n = typeof v === 'string' ? parseFloat(v) : v
    return isNaN(n)
        ? '—'
        : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DealSlideOver({ deal, stages, open, onClose, onDeleted }: DealSlideOverProps) {
    const patch = usePatchDeal()
    const deleteDeal = useDeleteDeal()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []

    const {
        control,
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isDirty },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: '',
            amount: 0,
            currency: 'EUR',
            probability: 0,
            stage: 'Découverte',
            expected_close: null,
            origin: null,
            notes: null,
            tags: [],
            company_id: null,
        },
    })

    // Réinitialiser le formulaire à l'ouverture
    useEffect(() => {
        if (deal) {
            reset({
                title: deal.title,
                amount: parseFloat(deal.amount) || 0,
                currency: deal.currency,
                probability: deal.probability,
                stage: deal.stage,
                expected_close: deal.expected_close ?? null,
                origin: deal.origin ?? null,
                notes: deal.notes ?? null,
                tags: deal.tags,
                company_id: deal.company_id ?? null,
            })
        }
    }, [deal, reset])

    const amount = watch('amount')
    const probability = watch('probability')
    const companyId = watch('company_id')
    const weightedPreview = (amount * probability) / 100

    const isLocked = deal?.is_locked ?? false

    const onSubmit = async (values: FormValues) => {
        if (!deal) return
        await patch.mutateAsync({ id: deal.id, data: values })
        onClose()
    }

    const handleDelete = async () => {
        if (!deal) return
        await deleteDeal.mutateAsync(deal.id)
        setConfirmDelete(false)
        onDeleted?.()
        onClose()
    }

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 0 } }}
            >
                {/* Header */}
                <Box
                    sx={{
                        px: 3,
                        py: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    <Typography variant="h6" sx={{ flex: 1 }} noWrap>
                        {deal?.title ?? 'Opportunité'}
                    </Typography>
                    {isLocked && (
                        <Tooltip title="Verrouillé — opportunité Gagnée">
                            <LockIcon color="success" fontSize="small" />
                        </Tooltip>
                    )}
                    <IconButton size="small" onClick={onClose} aria-label="Fermer">
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Informations rapides */}
                {deal && (
                    <Box sx={{ px: 3, py: 1.5, bgcolor: 'action.hover' }}>
                        <Stack direction="row" spacing={2} divider={<Divider orientation="vertical" flexItem />}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Montant
                                </Typography>
                                <Typography variant="body1" fontWeight={700}>
                                    {formatAmount(deal.amount)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Pondéré
                                </Typography>
                                <Typography variant="body1" fontWeight={700} color="primary">
                                    {formatAmount(deal.weighted_amount)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Stage
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {deal.stage}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>
                )}

                <Divider />

                {/* Formulaire */}
                <Box
                    component="form"
                    onSubmit={handleSubmit(onSubmit)}
                    sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}
                >
                    <Stack spacing={2.5}>
                        {patch.isError && (
                            <Alert severity="error">
                                Erreur lors de la sauvegarde. Vérifiez les champs verrouillés.
                            </Alert>
                        )}

                        {/* Titre */}
                        <TextField
                            label="Titre"
                            {...register('title')}
                            error={!!errors.title}
                            helperText={errors.title?.message}
                            fullWidth
                            size="small"
                            disabled={isLocked}
                        />

                        {/* Entreprise */}
                        <Autocomplete<CompanyOut>
                            options={companies}
                            getOptionLabel={(o) => o.name}
                            value={companies.find((c) => c.id === companyId) ?? null}
                            onChange={(_, v) => setValue('company_id', v?.id ?? null, { shouldDirty: true })}
                            size="small"
                            renderInput={(params) => (
                                <TextField {...params} label="Entreprise (optionnel)" fullWidth />
                            )}
                        />

                        {/* Stage */}
                        <Controller
                            name="stage"
                            control={control}
                            render={({ field }) => (
                                <FormControl fullWidth size="small">
                                    <InputLabel>Étape</InputLabel>
                                    <Select {...field} label="Étape">
                                        {stages.map((s) => (
                                            <MenuItem key={s.id} value={s.name}>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: 'inline-block',
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        bgcolor: s.color ?? 'grey.400',
                                                        mr: 1,
                                                    }}
                                                />
                                                {s.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        />

                        {/* Montant + devise */}
                        <Stack direction="row" spacing={1.5}>
                            <Controller
                                name="amount"
                                control={control}
                                render={({ field }) => (
                                    <FormControl fullWidth size="small" error={!!errors.amount}>
                                        <InputLabel>Montant (HT)</InputLabel>
                                        <OutlinedInput
                                            {...field}
                                            label="Montant (HT)"
                                            type="number"
                                            endAdornment={<InputAdornment position="end">€</InputAdornment>}
                                            disabled={isLocked}
                                        />
                                        {errors.amount && (
                                            <FormHelperText>{errors.amount.message}</FormHelperText>
                                        )}
                                    </FormControl>
                                )}
                            />
                        </Stack>

                        {/* Probabilité */}
                        <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography variant="body2" color="text.secondary">
                                    Probabilité
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {probability}% → {formatAmount(weightedPreview)} pondéré
                                </Typography>
                            </Stack>
                            <Controller
                                name="probability"
                                control={control}
                                render={({ field }) => (
                                    <Slider
                                        {...field}
                                        min={0}
                                        max={100}
                                        step={5}
                                        marks={[
                                            { value: 0 },
                                            { value: 25 },
                                            { value: 50 },
                                            { value: 75 },
                                            { value: 100 },
                                        ]}
                                        valueLabelDisplay="auto"
                                        valueLabelFormat={(v) => `${v}%`}
                                        disabled={isLocked}
                                    />
                                )}
                            />
                        </Box>

                        {/* Date de clôture */}
                        <TextField
                            label="Date de clôture estimée"
                            type="date"
                            {...register('expected_close')}
                            InputLabelProps={{ shrink: true }}
                            size="small"
                            fullWidth
                            disabled={isLocked}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <CalendarMonthIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Origine */}
                        <TextField
                            label="Origine"
                            {...register('origin')}
                            size="small"
                            fullWidth
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <BusinessIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {/* Notes */}
                        <TextField
                            label="Notes"
                            {...register('notes')}
                            multiline
                            rows={4}
                            size="small"
                            fullWidth
                        />

                        {/* Tags */}
                        <Controller
                            name="tags"
                            control={control}
                            render={({ field }) => (
                                <TagsInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    label="Tags"
                                />
                            )}
                        />
                    </Stack>
                </Box>

                {/* Footer actions */}
                <Box
                    sx={{
                        px: 3,
                        py: 2,
                        borderTop: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        gap: 1,
                    }}
                >
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSubmit(onSubmit)}
                        disabled={!isDirty || patch.isPending}
                        sx={{ flex: 1 }}
                    >
                        {patch.isPending ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setConfirmDelete(true)}
                        disabled={deleteDeal.isPending}
                    >
                        Supprimer
                    </Button>
                </Box>
            </Drawer>

            <ConfirmDialog
                open={confirmDelete}
                title="Supprimer l'opportunité"
                message={`Supprimer « ${deal?.title} » ? Cette action est irréversible.`}
                confirmLabel="Supprimer"
                danger
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    )
}
