import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BusinessIcon from '@mui/icons-material/Business'
import { useCompany } from '@/api/companies'
import { useContacts } from '@/api/contacts'
import { DataTable, type ColumnDef } from '@/components/common/DataTable'
import { type ContactOut } from '@/api/contacts'

export function CompanyDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: company, isLoading } = useCompany(id ?? '')
    const { data: contacts } = useContacts({ company_id: id, page_size: 50 })

    if (isLoading) return <CircularProgress sx={{ m: 4 }} />
    if (!company) return <Typography color="error">Entreprise introuvable</Typography>

    const columns: ColumnDef<ContactOut>[] = [
        { key: 'name', header: 'Nom', render: (r) => [r.first_name, r.last_name].filter(Boolean).join(' ') || '(sans nom)' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Téléphone' },
        { key: 'position', header: 'Poste' },
    ]

    return (
        <Box>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/companies')} sx={{ mb: 2 }}>
                Retour
            </Button>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <BusinessIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Box>
                        <Typography variant="h5" fontWeight={600}>{company.name}</Typography>
                        {company.sector && <Typography color="text.secondary">{company.sector}</Typography>}
                    </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1}>
                    {company.website && (
                        <Typography>
                            <strong>Site web :</strong>{' '}
                            <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a>
                        </Typography>
                    )}
                    {company.tags.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography component="span"><strong>Tags :</strong></Typography>
                            {company.tags.map((t) => <Chip key={t} label={t} size="small" />)}
                        </Stack>
                    )}
                    {company.notes && (
                        <Typography><strong>Notes :</strong> {company.notes}</Typography>
                    )}
                </Stack>
            </Paper>

            <Typography variant="h6" fontWeight={600} mb={1}>Contacts</Typography>
            <DataTable
                columns={columns}
                rows={contacts?.items ?? []}
                total={contacts?.total ?? 0}
                page={0}
                pageSize={50}
                onPageChange={() => { }}
                onPageSizeChange={() => { }}
                emptyMessage="Aucun contact associé"
            />
        </Box>
    )
}
