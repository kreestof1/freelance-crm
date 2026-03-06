import React, { useState, useMemo } from 'react'
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
    Paper,
    Divider,
    Badge,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PhoneIcon from '@mui/icons-material/Phone'
import EmailIcon from '@mui/icons-material/Email'
import TaskIcon from '@mui/icons-material/Task'
import EventIcon from '@mui/icons-material/Event'
import AlarmIcon from '@mui/icons-material/Alarm'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { format, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
    useActivities,
    useCreateActivity,
    useDeleteActivity,
    usePatchActivity,
    type ActivityOut,
    type ActivityType,
    type ActivityRelatedType,
} from '@/api/activities'
import { useLeads } from '@/api/leads'
import { useContacts } from '@/api/contacts'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: ActivityType[] = ['Appel', 'Email', 'Tâche', 'RDV']

const TYPE_ICON: Record<ActivityType, React.ReactNode> = {
    Appel: <PhoneIcon fontSize="small" />,
    Email: <EmailIcon fontSize="small" />,
    Tâche: <TaskIcon fontSize="small" />,
    RDV: <EventIcon fontSize="small" />,
}

const TYPE_COLOR: Record<ActivityType, 'primary' | 'info' | 'warning' | 'success'> = {
    Appel: 'primary',
    Email: 'info',
    Tâche: 'warning',
    RDV: 'success',
}

// ── Schema ────────────────────────────────────────────────────────────────────

const activitySchema = z.object({
    type: z.enum(['Appel', 'Email', 'Tâche', 'RDV']),
    when: z.string().min(1, 'Requis'),
    duration_min: z.coerce.number().int().positive().optional().nullable(),
    outcome: z.string().max(100).optional().nullable(),
    notes: z.string().max(10000).optional().nullable(),
    reminder_at: z.string().optional().nullable(),
})

type ActivityForm = z.infer<typeof activitySchema>

function toLocalDateTimeInput(isoUtc?: string | null): string {
    if (!isoUtc) return ''
    try {
        const d = parseISO(isoUtc)
        return format(d, "yyyy-MM-dd'T'HH:mm")
    } catch {
        return ''
    }
}

function fromLocalDateTimeInput(local: string): string {
    if (!local) return ''
    return new Date(local).toISOString()
}

// ── Activity Dialog ────────────────────────────────────────────────────────────

interface ActivityDialogProps {
    open: boolean
    onClose: () => void
    initial?: ActivityOut | null
}

function ActivityDialog({ open, onClose, initial }: ActivityDialogProps) {
    const { t } = useTranslation()
    const createActivity = useCreateActivity()
    const patchActivity = usePatchActivity()

    const defaultValues = useMemo<ActivityForm>(
        () => ({
            type: (initial?.type as ActivityType) ?? 'Tâche',
            when: toLocalDateTimeInput(initial?.when) || format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            duration_min: initial?.duration_min ?? null,
            outcome: initial?.outcome ?? null,
            notes: initial?.notes ?? null,
            reminder_at: toLocalDateTimeInput(initial?.reminder_at),
        }),
        [initial],
    )

    const {
        handleSubmit,
        reset,
        register,
        control,
        formState: { errors, isSubmitting },
    } = useForm<ActivityForm>({ resolver: zodResolver(activitySchema), defaultValues })

    // Lien vers un prospect ou un contact
    const isLegacyLink = !!(
        initial?.related_type &&
        initial.related_type !== 'lead' &&
        initial.related_type !== 'contact'
    )
    const [linkedType, setLinkedType] = useState<'lead' | 'contact' | ''>(
        !isLegacyLink && (initial?.related_type === 'lead' || initial?.related_type === 'contact')
            ? (initial.related_type as 'lead' | 'contact')
            : '',
    )
    const [linkedEntity, setLinkedEntity] = useState<{ id: string; label: string } | null>(
        !isLegacyLink && initial?.related_id && initial?.related_label
            ? { id: initial.related_id, label: initial.related_label }
            : null,
    )
    const [entitySearch, setEntitySearch] = useState('')

    const { data: leadsData, isLoading: leadsLoading } = useLeads({
        search: entitySearch || undefined,
        page_size: 100,
    })
    const { data: contactsData, isLoading: contactsLoading } = useContacts({
        search: entitySearch || undefined,
        page_size: 100,
    })

    const entityOptions = useMemo(() => {
        if (linkedType === 'lead') {
            return (leadsData?.items ?? []).map((l) => ({ id: l.id, label: l.name }))
        }
        if (linkedType === 'contact') {
            return (contactsData?.items ?? []).map((c) => ({
                id: c.id,
                label:
                    [c.first_name, c.last_name].filter(Boolean).join(' ') ||
                    (c.email ?? c.id),
            }))
        }
        return [] as { id: string; label: string }[]
    }, [linkedType, leadsData, contactsData])

    const autocompleteOptions = useMemo(
        () =>
            linkedEntity && !entityOptions.some((o) => o.id === linkedEntity.id)
                ? [linkedEntity, ...entityOptions]
                : entityOptions,
        [entityOptions, linkedEntity],
    )

    React.useEffect(() => {
        if (open) {
            const legacy = !!(
                initial?.related_type &&
                initial.related_type !== 'lead' &&
                initial.related_type !== 'contact'
            )
            setLinkedType(
                !legacy &&
                (initial?.related_type === 'lead' || initial?.related_type === 'contact')
                    ? (initial.related_type as 'lead' | 'contact')
                    : '',
            )
            setLinkedEntity(
                !legacy && initial?.related_id && initial?.related_label
                    ? { id: initial.related_id, label: initial.related_label }
                    : null,
            )
            setEntitySearch('')
            reset(defaultValues)
        }
    }, [open, reset, defaultValues])

    const onSubmit = async (values: ActivityForm) => {
        const legacy = !!(
            initial?.related_type &&
            initial.related_type !== 'lead' &&
            initial.related_type !== 'contact'
        )
        const payload = {
            ...values,
            when: fromLocalDateTimeInput(values.when),
            reminder_at: values.reminder_at ? fromLocalDateTimeInput(values.reminder_at) : null,
            ...(legacy
                ? {}
                : {
                      related_type: (linkedType || null) as ActivityRelatedType | null,
                      related_id: linkedEntity?.id ?? null,
                  }),
        }
        if (initial) {
            await patchActivity.mutateAsync({ id: initial.id, data: payload })
        } else {
            await createActivity.mutateAsync(payload)
        }
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {initial ? t('activities.edit') : t('activities.new')}
            </DialogTitle>
            <DialogContent>
                <Stack gap={2} mt={1}>
                    <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('activities.typeLabel')}</InputLabel>
                                <Select {...field} label={t('activities.typeLabel')}>
                                    {ACTIVITY_TYPES.map((tp) => (
                                        <MenuItem key={tp} value={tp}>
                                            <Stack direction="row" alignItems="center" gap={1}>
                                                {TYPE_ICON[tp]}
                                                {t(`activities.type.${tp}`)}
                                            </Stack>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    />
                    <TextField
                        {...register('when')}
                        label={t('activities.whenLabel')}
                        type="datetime-local"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.when}
                        helperText={errors.when?.message}
                    />
                    <TextField
                        {...register('duration_min')}
                        label={t('activities.durationLabel')}
                        type="number"
                        size="small"
                        placeholder="ex. 30"
                        inputProps={{ min: 1, max: 1440 }}
                    />
                    <TextField
                        {...register('outcome')}
                        label={t('activities.outcomeLabel')}
                        size="small"
                        placeholder="ex. Pas de réponse"
                    />
                    <TextField
                        {...register('notes')}
                        label={t('activities.notesLabel')}
                        size="small"
                        multiline
                        rows={3}
                    />
                    {/* Lien prospect / contact */}
                    {isLegacyLink ? (
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="body2" color="text.secondary">
                                {t('activities.linkedTypeLabel')} :
                            </Typography>
                            <Chip
                                label={`${t(`search.type.${initial!.related_type!}`)} — ${initial!.related_label ?? initial!.related_id}`}
                                size="small"
                                variant="outlined"
                            />
                        </Stack>
                    ) : (
                        <>
                            <FormControl fullWidth size="small">
                                <InputLabel>{t('activities.linkedTypeLabel')}</InputLabel>
                                <Select
                                    value={linkedType}
                                    label={t('activities.linkedTypeLabel')}
                                    onChange={(e) => {
                                        setLinkedType(e.target.value as 'lead' | 'contact' | '')
                                        setLinkedEntity(null)
                                        setEntitySearch('')
                                    }}
                                >
                                    <MenuItem value="">{t('activities.noLink')}</MenuItem>
                                    <MenuItem value="lead">
                                        {t('activities.relatedTypes.lead')}
                                    </MenuItem>
                                    <MenuItem value="contact">
                                        {t('activities.relatedTypes.contact')}
                                    </MenuItem>
                                </Select>
                            </FormControl>
                            {linkedType !== '' && (
                                <Autocomplete
                                    size="small"
                                    options={autocompleteOptions}
                                    getOptionLabel={(o) => o.label}
                                    isOptionEqualToValue={(a, b) => a.id === b.id}
                                    value={linkedEntity}
                                    loading={linkedType === 'lead' ? leadsLoading : contactsLoading}
                                    loadingText={t('common.loading')}
                                    onChange={(_, value) => setLinkedEntity(value)}
                                    onInputChange={(_, value) => setEntitySearch(value)}
                                    filterOptions={(x) => x}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={
                                                linkedType === 'lead'
                                                    ? t('activities.relatedTypes.lead')
                                                    : t('activities.relatedTypes.contact')
                                            }
                                            placeholder={t('activities.linkedEntityPlaceholder')}
                                        />
                                    )}
                                />
                            )}
                        </>
                    )}
                    <TextField
                        {...register('reminder_at')}
                        label={t('activities.reminderLabel')}
                        type="datetime-local"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                >
                    {t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

// ── Activity Card ─────────────────────────────────────────────────────────────

interface ActivityCardProps {
    activity: ActivityOut
    onEdit: (a: ActivityOut) => void
    onDelete: (a: ActivityOut) => void
}

function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
    const { t } = useTranslation()
    const hasUpcomingReminder =
        activity.reminder_at != null &&
        !activity.reminder_sent &&
        isAfter(parseISO(activity.reminder_at), new Date())

    const formattedDate = (() => {
        try {
            return format(parseISO(activity.when), 'd MMM yyyy, HH:mm', { locale: fr })
        } catch {
            return activity.when
        }
    })()

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                '&:hover': { boxShadow: 1 },
            }}
        >
            <Stack direction="row" alignItems="flex-start" gap={2}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: `${TYPE_COLOR[activity.type]}.light`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: `${TYPE_COLOR[activity.type]}.dark`,
                    }}
                >
                    {TYPE_ICON[activity.type]}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <Chip
                            label={t(`activities.type.${activity.type}`)}
                            size="small"
                            color={TYPE_COLOR[activity.type]}
                            variant="outlined"
                        />
                        <Typography variant="body2" color="text.secondary">
                            {formattedDate}
                        </Typography>
                        {activity.duration_min && (
                            <Typography variant="caption" color="text.secondary">
                                · {activity.duration_min} min
                            </Typography>
                        )}
                        {hasUpcomingReminder && (
                            <Tooltip
                                title={`Rappel : ${format(parseISO(activity.reminder_at!), 'd MMM HH:mm', { locale: fr })}`}
                            >
                                <Badge color="warning" variant="dot">
                                    <AlarmIcon fontSize="small" color="warning" />
                                </Badge>
                            </Tooltip>
                        )}
                    </Stack>

                    {activity.related_label && (
                        <Stack direction="row" alignItems="center" gap={0.5} mt={0.5} flexWrap="wrap">
                            {activity.related_type && (
                                <Chip
                                    label={t(`search.type.${activity.related_type}`)}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                />
                            )}
                            <Typography variant="body2" color="primary" fontWeight={500}>
                                {activity.related_label}
                            </Typography>
                        </Stack>
                    )}
                    {activity.outcome && (
                        <Typography variant="body2" mt={0.5}>
                            <strong>{t('activities.outcomeLabel')} :</strong> {activity.outcome}
                        </Typography>
                    )}
                    {activity.notes && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            mt={0.5}
                            sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 500,
                            }}
                        >
                            {activity.notes}
                        </Typography>
                    )}
                </Box>

                <Stack direction="row" gap={0.5}>
                    <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => onEdit(activity)}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                        <IconButton size="small" color="error" onClick={() => onDelete(activity)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Paper>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ActivitiesPage() {
    const { t } = useTranslation()
    const [typeFilter, setTypeFilter] = useState<ActivityType | ''>('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<ActivityOut | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ActivityOut | null>(null)

    const { data, isLoading } = useActivities({ type: typeFilter || undefined })
    const deleteActivity = useDeleteActivity()

    const activities = data?.items ?? []

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h5" fontWeight={600}>
                    {t('activities.title')}
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setEditTarget(null)
                        setDialogOpen(true)
                    }}
                >
                    {t('activities.new')}
                </Button>
            </Stack>

            <Stack direction="row" gap={2} mb={3} flexWrap="wrap" alignItems="center">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{t('activities.typeLabel')}</InputLabel>
                    <Select
                        value={typeFilter}
                        label={t('activities.typeLabel')}
                        onChange={(e) => setTypeFilter(e.target.value as ActivityType | '')}
                    >
                        <MenuItem value="">{t('activities.allTypes')}</MenuItem>
                        {ACTIVITY_TYPES.map((tp) => (
                            <MenuItem key={tp} value={tp}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    {TYPE_ICON[tp as ActivityType]}
                                    {t(`activities.type.${tp}`)}
                                </Stack>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Typography variant="body2" color="text.secondary">
                    {data?.total ?? 0} activité{(data?.total ?? 0) > 1 ? 's' : ''}
                </Typography>
            </Stack>

            {isLoading ? (
                <Typography color="text.secondary">{t('common.loading')}</Typography>
            ) : activities.length === 0 ? (
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    py={8}
                    gap={1}
                >
                    <EventIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                    <Typography color="text.secondary">{t('activities.empty')}</Typography>
                </Box>
            ) : (
                <Stack gap={1.5}>
                    {activities.map((activity, i) => (
                        <React.Fragment key={activity.id}>
                            {i > 0 &&
                                (() => {
                                    const prevDay = format(parseISO(activities[i - 1].when), 'd MMM yyyy', { locale: fr })
                                    const thisDay = format(parseISO(activity.when), 'd MMM yyyy', { locale: fr })
                                    if (prevDay !== thisDay) {
                                        return (
                                            <Divider>
                                                <Typography variant="caption" color="text.secondary">
                                                    {thisDay}
                                                </Typography>
                                            </Divider>
                                        )
                                    }
                                    return null
                                })()}
                            <ActivityCard
                                activity={activity}
                                onEdit={(a) => {
                                    setEditTarget(a)
                                    setDialogOpen(true)
                                }}
                                onDelete={setDeleteTarget}
                            />
                        </React.Fragment>
                    ))}
                </Stack>
            )}

            <ActivityDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditTarget(null) }} initial={editTarget} />

            <ConfirmDialog
                open={!!deleteTarget}
                title={t('activities.deleteConfirm')}
                description={`Supprimer l'activité "${deleteTarget ? t(`activities.type.${deleteTarget.type}`) : ''}" ?`}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    await deleteActivity.mutateAsync(deleteTarget.id)
                    setDeleteTarget(null)
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </Box>
    )
}
