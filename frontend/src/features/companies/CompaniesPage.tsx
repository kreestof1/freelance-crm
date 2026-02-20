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
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import BusinessIcon from '@mui/icons-material/Business'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TagsInput } from '@/components/common/TagsInput'
import {
    useCompanies,
    useCreateCompany,
    useDeleteCompany,
    type CompanyOut,
} from '@/api/companies'

const createCompanySchema = z.object({
    name: z.string().min(1, 'Requis'),
    sector: z.string().optional(),
    website: z.string().url('URL invalide').optional().or(z.literal('')),
    notes: z.string().optional(),
    tags: z.array(z.string()).default([]),
})

type CreateCompanyForm = z.infer<typeof createCompanySchema>

function CreateCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createCompany = useCreateCompany()
    const { control, handleSubmit, reset, setValue, watch } = useForm<CreateCompanyForm>({
        resolver: zodResolver(createCompanySchema),
        defaultValues: { tags: [] },
    })
    const tags = watch('tags')

    const onSubmit = async (data: CreateCompanyForm) => {
        await createCompany.mutateAsync({ ...data, website: data.website || undefined })
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Nouvelle entreprise</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Controller name="name" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} label="Nom *" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <Controller name="sector" control={control} render={({ field }) => (
                            <TextField {...field} label="Secteur" fullWidth size="small" />
                        )} />
                        <Controller name="website" control={control} render={({ field, fieldState }) => (
                            <TextField {...field} label="Site web" error={!!fieldState.error} helperText={fieldState.error?.message} fullWidth size="small" />
                        )} />
                        <TagsInput value={tags} onChange={(t) => setValue('tags', t)} />
                        <Controller name="notes" control={control} render={({ field }) => (
                            <TextField {...field} label="Notes" multiline rows={3} fullWidth size="small" />
                        )} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="contained" disabled={createCompany.isPending}>Créer</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

export function CompaniesPage() {
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(25)
    const [createOpen, setCreateOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<CompanyOut | null>(null)

    const deleteCompany = useDeleteCompany()

    const { data, isLoading } = useCompanies({
        search: search || undefined,
        page: page + 1,
        page_size: pageSize,
    })

    const columns: ColumnDef<CompanyOut>[] = [
        {
            key: 'name', header: 'Entreprise', sortable: true,
            render: (row) => (
                <Stack direction="row" spacing={1} alignItems="center">
                    <BusinessIcon fontSize="small" color="action" />
                    <span>{row.name}</span>
                </Stack>
            ),
        },
        { key: 'sector', header: 'Secteur' },
        { key: 'contacts_count', header: 'Contacts', align: 'center', render: (row) => String(row.contacts_count) },
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
                <Tooltip title="Supprimer">
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ]

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" fontWeight={600}>Entreprises</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Nouvelle entreprise</Button>
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
                onPageChange={setPage} onPageSizeChange={(ps) => { setPageSize(ps); setPage(0) }}
                emptyMessage="Aucune entreprise"
            />

            <CreateCompanyDialog open={createOpen} onClose={() => setCreateOpen(false)} />
            <ConfirmDialog
                open={!!deleteTarget} title="Supprimer l'entreprise"
                message={`Voulez-vous supprimer « ${deleteTarget?.name} » ?`}
                confirmLabel="Supprimer" danger loading={deleteCompany.isPending}
                onConfirm={async () => { if (deleteTarget) await deleteCompany.mutateAsync(deleteTarget.id); setDeleteTarget(null) }}
                onCancel={() => setDeleteTarget(null)}
            />
        </Box>
    )
}
