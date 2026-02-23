import React, { useState } from 'react'
import {
    Box,
    Chip,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
    useAllDocuments,
    useDeleteDocument,
    type DocumentOut,
    type DocumentType,
    type RelatedType,
} from '@/api/documents'

const DOC_TYPES: DocumentType[] = ['Brief', 'Proposition', 'Contrat', 'Autre']
const ENTITY_TYPES: RelatedType[] = ['project', 'deal']

function formatBytes(bytes: number | null): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
    try {
        return format(parseISO(iso), 'd MMM yyyy', { locale: fr })
    } catch {
        return iso
    }
}

export function DocumentsPage() {
    const { t } = useTranslation()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('')
    const [entityFilter, setEntityFilter] = useState<RelatedType | ''>('')
    const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null)

    const { data, isLoading } = useAllDocuments({
        type: typeFilter || undefined,
        related_type: entityFilter || undefined,
    })

    const deleteDoc = useDeleteDocument()

    const rows: DocumentOut[] = (data?.items ?? []).filter((d) => {
        if (!search) return true
        return d.filename.toLowerCase().includes(search.toLowerCase())
    })

    const columns: ColumnDef<DocumentOut>[] = [
        {
            key: 'filename',
            header: t('documents.filenameLabel'),
            render: (row) => (
                <Stack direction="row" alignItems="center" gap={1}>
                    <InsertDriveFileIcon fontSize="small" color="action" />
                    <Box>
                        <Typography variant="body2" fontWeight={500}>
                            {row.filename}
                        </Typography>
                        {row.size_bytes && (
                            <Typography variant="caption" color="text.secondary">
                                {formatBytes(row.size_bytes)}
                            </Typography>
                        )}
                    </Box>
                </Stack>
            ),
        },
        {
            key: 'type',
            header: t('documents.typeLabel'),
            render: (row) => (
                <Chip
                    label={t(`documents.type.${row.type}`)}
                    size="small"
                    variant="outlined"
                    color={
                        row.type === 'Contrat'
                            ? 'success'
                            : row.type === 'Proposition'
                              ? 'primary'
                              : row.type === 'Brief'
                                ? 'info'
                                : 'default'
                    }
                />
            ),
        },
        {
            key: 'related',
            header: t('documents.relatedLabel'),
            render: (row) =>
                row.related_type ? (
                    <Chip
                        label={row.related_type === 'project' ? 'Mission' : 'Opportunité'}
                        size="small"
                        variant="filled"
                        sx={{ bgcolor: 'grey.100' }}
                    />
                ) : (
                    <Typography variant="body2" color="text.secondary">
                        —
                    </Typography>
                ),
        },
        {
            key: 'date',
            header: 'Date',
            render: (row) => (
                <Typography variant="body2" color="text.secondary">
                    {formatDate(row.created_at)}
                </Typography>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (row) => (
                <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                    {(row.signed_url || row.external_url) && (
                        <Tooltip title="Ouvrir">
                            <IconButton
                                size="small"
                                component={Link}
                                href={row.signed_url ?? row.external_url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(row)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ]

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="h5" fontWeight={600}>
                    {t('documents.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {data?.total ?? 0} document{(data?.total ?? 0) > 1 ? 's' : ''}
                </Typography>
            </Stack>

            {/* Filtres */}
            <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
                <TextField
                    size="small"
                    placeholder="Rechercher…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <InsertDriveFileIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: 220 }}
                />

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>{t('documents.typeLabel')}</InputLabel>
                    <Select
                        value={typeFilter}
                        label={t('documents.typeLabel')}
                        onChange={(e) => setTypeFilter(e.target.value as DocumentType | '')}
                    >
                        <MenuItem value="">Tous les types</MenuItem>
                        {DOC_TYPES.map((tp) => (
                            <MenuItem key={tp} value={tp}>
                                {t(`documents.type.${tp}`)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Entité</InputLabel>
                    <Select
                        value={entityFilter}
                        label="Entité"
                        onChange={(e) => setEntityFilter(e.target.value as RelatedType | '')}
                    >
                        <MenuItem value="">Toutes les entités</MenuItem>
                        {ENTITY_TYPES.map((et) => (
                            <MenuItem key={et} value={et}>
                                {et === 'project' ? 'Missions' : 'Opportunités'}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>

            {/* Table */}
            {rows.length === 0 && !isLoading ? (
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    py={8}
                    gap={1}
                >
                    <InsertDriveFileIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                    <Typography color="text.secondary">{t('documents.empty')}</Typography>
                </Box>
            ) : (
                <DataTable columns={columns} rows={rows} loading={isLoading} rowKey="id" />
            )}

            {/* Delete confirm */}
            <ConfirmDialog
                open={!!deleteTarget}
                title={t('documents.deleteConfirm')}
                description={`Supprimer "${deleteTarget?.filename}" ?`}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    await deleteDoc.mutateAsync(deleteTarget.id)
                    setDeleteTarget(null)
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </Box>
    )
}

