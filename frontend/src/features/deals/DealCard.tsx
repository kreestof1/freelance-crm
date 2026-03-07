import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import ArticleIcon from '@mui/icons-material/Article'
import BusinessIcon from '@mui/icons-material/Business'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import {
    Box,
    Chip,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    alpha,
    useTheme,
} from '@mui/material'
import type { DealOut } from '@/api/deals'

interface DealCardProps {
    deal: DealOut
    onClick: (deal: DealOut) => void
    isDragging?: boolean
}

function formatAmount(value: string | number): string {
    const n = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(n)) return '—'
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n)
}

function formatDate(iso: string | null): string {
    if (!iso) return ''
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso))
}

export function DealCard({ deal, onClick, isDragging = false }: DealCardProps) {
    const theme = useTheme()
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    }

    const weighted = parseFloat(deal.weighted_amount)
    const isOverdue =
        deal.expected_close &&
        new Date(deal.expected_close) < new Date() &&
        deal.stage !== 'Gagné' &&
        deal.stage !== 'Perdu'

    return (
        <Paper
            ref={setNodeRef}
            elevation={isDragging ? 6 : 1}
            sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                bgcolor: theme.palette.background.paper,
                transition: 'box-shadow 0.15s, opacity 0.15s',
                '&:hover': { boxShadow: theme.shadows[3] },
                ...style,
            }}
            {...attributes}
            {...listeners}
        >
            {/* Header */}
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={0.5}>
                <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                        flex: 1,
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main' },
                        lineHeight: 1.3,
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        onClick(deal)
                    }}
                >
                    {deal.title}
                </Typography>
                {deal.is_locked && (
                    <Tooltip title="Opportunité verrouillée (Gagnée)">
                        <LockIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                    </Tooltip>
                )}
            </Stack>

            {/* Montant */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1}>
                <Typography variant="body2" fontWeight={700} color="primary">
                    {formatAmount(deal.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Pond.&nbsp;
                    <strong>{formatAmount(weighted)}</strong>
                </Typography>
            </Stack>

            {/* Méta */}
            <Stack direction="column" spacing={0.25} mt={0.75}>
                {deal.company_name && (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <BusinessIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {deal.company_name}
                        </Typography>
                    </Stack>
                )}
                {deal.contact_name && (
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <PersonIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {deal.contact_name}
                        </Typography>
                    </Stack>
                )}
            </Stack>

            {/* Footer */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1}>
                <Chip
                    label={`${deal.probability}%`}
                    size="small"
                    sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                    }}
                />
                {deal.expected_close && (
                    <Typography
                        variant="caption"
                        color={isOverdue ? 'error' : 'text.secondary'}
                        fontWeight={isOverdue ? 700 : 400}
                    >
                        {formatDate(deal.expected_close)}
                    </Typography>
                )}
            </Stack>

            {/* Tags */}
            {deal.tags.length > 0 && (
                <Box mt={0.75} sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {deal.tags.slice(0, 3).map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                    ))}
                    {deal.tags.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                            +{deal.tags.length - 3}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Indicateur mission créée (opportunités gagnées) */}
            {deal.is_locked && deal.has_project && (
                <Stack direction="row" alignItems="center" spacing={0.5} mt={0.75}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 13, color: 'success.main' }} />
                    <Typography variant="caption" color="success.main" fontWeight={600}>
                        Mission créée
                    </Typography>
                </Stack>
            )}
        </Paper>
    )
}
