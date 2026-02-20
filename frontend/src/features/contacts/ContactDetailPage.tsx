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
import PersonIcon from '@mui/icons-material/Person'
import { useContact } from '@/api/contacts'

export function ContactDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: contact, isLoading } = useContact(id ?? '')

    if (isLoading) return <CircularProgress sx={{ m: 4 }} />
    if (!contact) return <Typography color="error">Contact introuvable</Typography>

    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '(sans nom)'

    return (
        <Box>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/contacts')} sx={{ mb: 2 }}>
                Retour
            </Button>

            <Paper variant="outlined" sx={{ p: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <PersonIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Box>
                        <Typography variant="h5" fontWeight={600}>{fullName}</Typography>
                        {contact.position && <Typography color="text.secondary">{contact.position}</Typography>}
                    </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1}>
                    {contact.email && (
                        <Typography>
                            <strong>Email :</strong>{' '}
                            <a href={`mailto:${contact.email}`}>{contact.email}</a>
                        </Typography>
                    )}
                    {contact.phone && (
                        <Typography><strong>Téléphone :</strong> {contact.phone}</Typography>
                    )}
                    {contact.company_name && (
                        <Typography><strong>Entreprise :</strong> {contact.company_name}</Typography>
                    )}
                    {contact.tags.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography component="span"><strong>Tags :</strong></Typography>
                            {contact.tags.map((t) => <Chip key={t} label={t} size="small" />)}
                        </Stack>
                    )}
                    {contact.notes && (
                        <Typography><strong>Notes :</strong> {contact.notes}</Typography>
                    )}
                </Stack>
            </Paper>
        </Box>
    )
}
