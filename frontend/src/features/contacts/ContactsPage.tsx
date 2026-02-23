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
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import MergeTypeIcon from '@mui/icons-material/MergeType'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DownloadIcon from '@mui/icons-material/Download'
import GppGoodIcon from '@mui/icons-material/GppGood'
import GppBadIcon from '@mui/icons-material/GppBad'
import NoEncryptionIcon from '@mui/icons-material/NoEncryption'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagsInput } from '@/components/common/TagsInput'
import { ImportCsvWizard } from './ImportCsvWizard'
import {
    useContacts,
    useCreateContact,
    useUpdateContact,
    useDeleteContact,
    useMergeContacts,
    useAnonymizeContact,
    type ContactOut,
} from '@/api/contacts'
import { exportApi } from '@/api/export'
import { useCompanies } from '@/api/companies'

const contactSchema = z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email('Email invalide').optional().or(z.literal('')),
    phone: z.string().optional(),
    position: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
    consent_rgpd: z.boolean().default(false),
    company_id: z.string().uuid().nullable().optional(),
})

type ContactForm = z.infer<typeof contactSchema>

function CreateContactDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createContact = useCreateContact()
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []

    const { control, handleSubmit, reset, setValue, watch } = useForm<ContactForm>({
        resolver: zodResolver(contactSchema),
        defaultValues: { tags: [], consent_rgpd: false, company_id: null },
    })
    const tags = watch('tags')
    const company_id = watch('company_id')

    const onSubmit = async (data: ContactForm) => {
        await createContact.mutateAsync({
            ...data,
            email: data.email || undefined,
            company_id: data.company_id ?? undefined,
        })
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Nouveau contact</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Stack direction="row" spacing={2}>
                            <Controller name="first_name" control={control} render={({ field }) => (
                                <TextField {...field} label="Prénom" fullWidth size="small" />
                            )} />
                            <Controller name="last_name" control={control} render={({ field }) => (
                                <TextField {...field} label="Nom" fullWidth size="small" />
                            )} />
                        </Stack>
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} label="Email" type="email" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <Controller name="phone" control={control} render={({ field }) => (
                            <TextField {...field} label="Téléphone" fullWidth size="small" />
                        )} />
                        <Controller name="position" control={control} render={({ field }) => (
                            <TextField {...field} label="Poste" fullWidth size="small" />
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
                            <TextField {...field} label="Notes" multiline rows={3} fullWidth size="small" />
                        )} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" disabled={createContact.isPending}>Créer</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

function EditContactDialog({ contact, onClose }: { contact: ContactOut | null; onClose: () => void }) {
    const updateContact = useUpdateContact()
    const { data: companiesData } = useCompanies({ page_size: 200 })
    const companies = companiesData?.items ?? []

    const { control, handleSubmit, reset, setValue, watch } = useForm<ContactForm>({
        resolver: zodResolver(contactSchema),
        defaultValues: { tags: [], consent_rgpd: false, company_id: null },
    })
    const tags = watch('tags')
    const company_id = watch('company_id')

    React.useEffect(() => {
        if (contact) {
            reset({
                first_name: contact.first_name ?? '',
                last_name: contact.last_name ?? '',
                email: contact.email ?? '',
                phone: contact.phone ?? '',
                position: contact.position ?? '',
                notes: contact.notes ?? '',
                tags: contact.tags ?? [],
                consent_rgpd: contact.consent_rgpd ?? false,
                company_id: contact.company_id ?? null,
            })
        }
    }, [contact, reset])

    const onSubmit = async (data: ContactForm) => {
        if (!contact) return
        await updateContact.mutateAsync({
            id: contact.id,
            data: {
                ...data,
                email: data.email || undefined,
                company_id: data.company_id ?? null,
            },
        })
        onClose()
    }

    return (
        <Dialog open={!!contact} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Modifier le contact</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Stack direction="row" spacing={2}>
                            <Controller name="first_name" control={control} render={({ field }) => (
                                <TextField {...field} label="Prénom" fullWidth size="small" />
                            )} />
                            <Controller name="last_name" control={control} render={({ field }) => (
                                <TextField {...field} label="Nom" fullWidth size="small" />
                            )} />
                        </Stack>
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} label="Email" type="email" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <Controller name="phone" control={control} render={({ field }) => (
                            <TextField {...field} label="Téléphone" fullWidth size="small" />
                        )} />
                        <Controller name="position" control={control} render={({ field }) => (
                            <TextField {...field} label="Poste" fullWidth size="small" />
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
                            <TextField {...field} label="Notes" multiline rows={3} fullWidth size="small" />
                        )} />
                        <Controller name="consent_rgpd" control={control} render={({ field }) => (
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <input
                                    type="checkbox"
                                    id="consent_rgpd_edit"
                                    checked={!!field.value}
                                    onChange={(e) => field.onChange(e.target.checked)}
                                />
                                <label htmlFor="consent_rgpd_edit" style={{ fontSize: 14 }}>Consentement RGPD</label>
                            </Stack>
                        )} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" disabled={updateContact.isPending}>Enregistrer</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

export function ContactsPage() {
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(25)
    const [createOpen, setCreateOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<ContactOut | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ContactOut | null>(null)
    const [anonymizeTarget, setAnonymizeTarget] = useState<ContactOut | null>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
    const [exporting, setExporting] = useState(false)

    const deleteContact = useDeleteContact()
    const mergeContacts = useMergeContacts()
    const anonymizeContact = useAnonymizeContact()

    const { data, isLoading } = useContacts({
        search: search || undefined,
        page: page + 1,
        page_size: pageSize,
    })

    const columns: ColumnDef<ContactOut>[] = [
        {
            key: 'name', header: 'Nom',
            render: (row) => (
                <Stack direction="row" alignItems="center" spacing={1}>
                    {row.anonymized_at
                        ? <NoEncryptionIcon fontSize="small" color="disabled" />
                        : row.consent_rgpd
                            ? <GppGoodIcon fontSize="small" color="success" />
                            : <GppBadIcon fontSize="small" color="disabled" />}
                    <span>{[row.first_name, row.last_name].filter(Boolean).join(' ') || '(sans nom)'}</span>
                </Stack>
            ),
        },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Téléphone' },
        { key: 'position', header: 'Poste' },
        { key: 'company_name', header: 'Entreprise', render: (row) => row.company_name ?? '—' },
        {
            key: 'tags', header: 'Tags',
            render: (row) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {row.tags.slice(0, 3).map((t) => <Chip key={t} label={t} size="small" />)}
                    {row.tags.length > 3 && <Chip label={`+${row.tags.length - 3}`} size="small" variant="outlined" />}
                </Stack>
            ),
        },
        {
            key: 'actions', header: '', align: 'right',
            render: (row) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {!row.anonymized_at && (
                        <Tooltip title="Modifier">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditTarget(row) }}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {!row.anonymized_at && (
                        <Tooltip title="Anonymiser (RGPD)">
                            <IconButton size="small" color="warning" onClick={(e) => { e.stopPropagation(); setAnonymizeTarget(row) }}>
                                <NoEncryptionIcon fontSize="small" />
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

    const handleMerge = async () => {
        if (selected.length !== 2) return
        await mergeContacts.mutateAsync({ source_id: selected[0], target_id: selected[1] })
        setSelected([])
        setMergeConfirmOpen(false)
    }

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" fontWeight={600}>Contacts</Typography>
                <Stack direction="row" spacing={1}>
                    {selected.length === 2 && (
                        <Button variant="outlined" startIcon={<MergeTypeIcon />} onClick={() => setMergeConfirmOpen(true)}>Fusionner</Button>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        disabled={exporting}
                        onClick={async () => {
                            setExporting(true)
                            try { await exportApi.contacts() } finally { setExporting(false) }
                        }}
                    >
                        Export CSV
                    </Button>
                    <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>Importer CSV</Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Nouveau contact</Button>
                </Stack>
            </Stack>

            <Stack direction="row" spacing={2} mb={2}>
                <TextField
                    size="small" placeholder="Rechercher…" value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    sx={{ flex: 1, maxWidth: 320 }}
                />
            </Stack>

            <DataTable
                columns={columns} rows={data?.items ?? []} total={data?.total ?? 0}
                page={page} pageSize={pageSize} loading={isLoading}
                selectable selected={selected} onSelectionChange={setSelected}
                onPageChange={setPage} onPageSizeChange={(ps) => { setPageSize(ps); setPage(0) }}
                emptyMessage="Aucun contact"
            />

            <CreateContactDialog open={createOpen} onClose={() => setCreateOpen(false)} />
            <EditContactDialog contact={editTarget} onClose={() => setEditTarget(null)} />
            <ImportCsvWizard open={importOpen} onClose={() => setImportOpen(false)} />

            <ConfirmDialog
                open={mergeConfirmOpen} title="Fusionner les contacts"
                message="Le premier contact sélectionné sera absorbé dans le second. Cette action est irréversible."
                confirmLabel="Fusionner" loading={mergeContacts.isPending}
                onConfirm={handleMerge} onCancel={() => setMergeConfirmOpen(false)}
            />

            <ConfirmDialog
                open={!!anonymizeTarget}
                title="Anonymiser ce contact (RGPD)"
                description={`Les données personnelles de "${[anonymizeTarget?.first_name, anonymizeTarget?.last_name].filter(Boolean).join(' ')}" seront effacées. Cette action est irréversible.`}
                confirmLabel="Anonymiser"
                loading={anonymizeContact.isPending}
                onConfirm={async () => {
                    if (anonymizeTarget) await anonymizeContact.mutateAsync(anonymizeTarget.id)
                    setAnonymizeTarget(null)
                }}
                onCancel={() => setAnonymizeTarget(null)}
            />

            <ConfirmDialog
                open={!!deleteTarget} title="Supprimer le contact"
                message={`Voulez-vous supprimer ce contact ?`}
                confirmLabel="Supprimer" danger loading={deleteContact.isPending}
                onConfirm={async () => { if (deleteTarget) await deleteContact.mutateAsync(deleteTarget.id); setDeleteTarget(null) }}
                onCancel={() => setDeleteTarget(null)}
            />
        </Box>
    )
}
