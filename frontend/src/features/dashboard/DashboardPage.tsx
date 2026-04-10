import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    Paper,
    Stack,
    Typography,
    alpha,
    useTheme,
} from '@mui/material'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { useForecastDashboard, useMissionsActivePerMonth, useMissionsPerMonth, usePipelineDashboard } from '@/api/dashboard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(raw: string | number) {
    const n = typeof raw === 'string' ? parseFloat(raw) : raw
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
        compactDisplay: 'short',
    }).format(n)
}

function fmtAmountFull(raw: string | number) {
    const n = typeof raw === 'string' ? parseFloat(raw) : raw
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n)
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
    label: string
    value: string
    sub?: string
    color?: string
}

function KpiCard({ label, value, sub, color }: KpiCardProps) {
    const theme = useTheme()
    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                borderLeft: `4px solid ${color ?? theme.palette.primary.main}`,
                height: '100%',
            }}
        >
            <CardContent>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
                    {label}
                </Typography>
                <Typography variant="h4" fontWeight={800} mt={0.5} color={color}>
                    {value}
                </Typography>
                {sub && (
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                        {sub}
                    </Typography>
                )}
            </CardContent>
        </Card>
    )
}

// ── Pipeline Section ──────────────────────────────────────────────────────────

function PipelineSection() {
    const theme = useTheme()
    const { data, isLoading, isError } = usePipelineDashboard()

    if (isLoading) return <CircularProgress size={24} />
    if (isError || !data) return <Alert severity="error">Erreur pipeline</Alert>

    return (
        <Stack spacing={3}>
            {/* KPI globaux */}
            <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                    <KpiCard
                        label="Deals actifs"
                        value={String(data.total_count)}
                        color={theme.palette.info.main}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <KpiCard
                        label="Montant total"
                        value={fmtAmount(data.total_amount)}
                        sub={fmtAmountFull(data.total_amount)}
                        color={theme.palette.primary.main}
                    />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <KpiCard
                        label="Montant pondéré"
                        value={fmtAmount(data.total_weighted)}
                        sub={fmtAmountFull(data.total_weighted)}
                        color={theme.palette.success.main}
                    />
                </Grid>
            </Grid>

            {/* Répartition par stage */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700} mb={2}>
                    Répartition par étape
                </Typography>
                <Stack spacing={1.5}>
                    {data.stages.map((s) => {
                        const pct = data.total_count > 0 ? (s.count / data.total_count) * 100 : 0
                        const color = s.color ?? theme.palette.grey[500]
                        return (
                            <Box key={s.stage}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
                                        <Typography variant="body2" fontWeight={600}>
                                            {s.stage}
                                        </Typography>
                                        <Chip
                                            label={s.count}
                                            size="small"
                                            sx={{ height: 18, fontSize: 11, bgcolor: alpha(color, 0.15), color }}
                                        />
                                    </Stack>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Typography variant="body2" color="text.secondary">
                                            {fmtAmount(s.total_amount)}
                                        </Typography>
                                        <Typography variant="body2" color="success.main">
                                            {fmtAmount(s.weighted_amount)} pond.
                                        </Typography>
                                    </Stack>
                                </Stack>
                                <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(color, 0.15), overflow: 'hidden' }}>
                                    <Box
                                        sx={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            bgcolor: color,
                                            borderRadius: 3,
                                            transition: 'width 0.6s ease',
                                        }}
                                    />
                                </Box>
                            </Box>
                        )
                    })}
                </Stack>
            </Paper>
        </Stack>
    )
}

// ── Forecast Section ──────────────────────────────────────────────────────────

interface ChartTooltipProps {
    active?: boolean
    payload?: Array<{ value: number; name: string; fill: string }>
    label?: string
}

function ForecastTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null
    return (
        <Paper elevation={4} sx={{ p: 1.5, borderRadius: 2, minWidth: 160 }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
                {label}
            </Typography>
            {payload.map((p) => (
                <Stack key={p.name} direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="caption" color="text.secondary">
                        {p.name}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color={p.fill}>
                        {fmtAmountFull(p.value)}
                    </Typography>
                </Stack>
            ))}
        </Paper>
    )
}

function ForecastSection() {
    const theme = useTheme()
    const { data, isLoading, isError } = useForecastDashboard()

    if (isLoading) return <CircularProgress size={24} />
    if (isError || !data) return <Alert severity="error">Erreur prévisions</Alert>

    const current = data.current_month
    const all = [current, ...data.next_3_months]

    const chartData = all.map((p) => ({
        name: p.label,
        'Montant total': parseFloat(p.total_amount),
        'Pondéré': parseFloat(p.weighted_amount),
        count: p.count,
    }))

    const colors = {
        'Montant total': theme.palette.primary.light,
        'Pondéré': theme.palette.success.main,
    }

    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                    Prévisions — deals attendus
                </Typography>
                <Stack direction="row" spacing={1.5}>
                    {Object.entries(colors).map(([name, c]) => (
                        <Stack key={name} direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: c }} />
                            <Typography variant="caption" color="text.secondary">{name}</Typography>
                        </Stack>
                    ))}
                </Stack>
            </Stack>

            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tickFormatter={(v) => fmtAmount(v)}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                    />
                    <Tooltip content={<ForecastTooltip />} cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }} />
                    {Object.entries(colors).map(([name, c]) => (
                        <Bar key={name} dataKey={name} radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {chartData.map((_, idx) => (
                                <Cell
                                    key={idx}
                                    fill={idx === 0 ? alpha(c, 0.6) : c}
                                    opacity={idx === 0 ? 0.7 : 1}
                                />
                            ))}
                        </Bar>
                    ))}
                </BarChart>
            </ResponsiveContainer>

            {/* Cards période */}
            <Grid container spacing={1.5} mt={1}>
                {all.map((p, i) => (
                    <Grid item xs={6} sm={3} key={p.label}>
                        <Box
                            sx={{
                                p: 1.5,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: i === 0 ? 'primary.main' : 'divider',
                                bgcolor: i === 0 ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                            }}
                        >
                            <Typography variant="caption" fontWeight={700} color={i === 0 ? 'primary.main' : 'text.secondary'}>
                                {p.label} {i === 0 && '(en cours)'}
                            </Typography>
                            <Typography variant="subtitle2" fontWeight={800} mt={0.25}>
                                {fmtAmount(p.total_amount)}
                            </Typography>
                            <Typography variant="caption" color="success.main">
                                {fmtAmount(p.weighted_amount)} pond.
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                                {p.count} deal{p.count > 1 ? 's' : ''}
                            </Typography>
                        </Box>
                    </Grid>
                ))}
            </Grid>
        </Paper>
    )
}

// ── Missions par mois ─────────────────────────────────────────────────────────

interface MissionsTooltipProps {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
}

function MissionsTooltip({ active, payload, label }: MissionsTooltipProps) {
    if (!active || !payload?.length) return null
    const count = payload[0].value
    return (
        <Paper elevation={4} sx={{ p: 1.5, borderRadius: 2, minWidth: 140 }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
                {label}
            </Typography>
            <Typography variant="caption" fontWeight={700} color="primary.main">
                {count} mission{count > 1 ? 's' : ''}
            </Typography>
        </Paper>
    )
}

function MissionsPerMonthSection() {
    const theme = useTheme()
    const { data, isLoading, isError } = useMissionsPerMonth()

    if (isLoading) return <CircularProgress size={24} />
    if (isError || !data) return <Alert severity="error">Erreur missions par mois</Alert>

    const chartData = data.points.map((p) => ({ name: p.label, Missions: p.count }))
    const maxCount = Math.max(...data.points.map((p) => p.count), 1)
    const totalYear = data.points.reduce((acc, p) => acc + p.count, 0)

    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                        Missions réalisées par mois
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Projets clôturés — 12 derniers mois
                    </Typography>
                </Box>
                <Chip
                    label={`${totalYear} au total`}
                    size="small"
                    sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.12),
                        color: 'secondary.main',
                        fontWeight: 700,
                    }}
                />
            </Stack>

            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={48}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={[0, Math.ceil(maxCount * 1.2) || 1]}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                    />
                    <Tooltip content={<MissionsTooltip />} cursor={{ fill: alpha(theme.palette.secondary.main, 0.06) }} />
                    <Bar dataKey="Missions" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((entry, idx) => (
                            <Cell
                                key={idx}
                                fill={
                                    entry.Missions === maxCount
                                        ? theme.palette.secondary.main
                                        : alpha(theme.palette.secondary.main, 0.55)
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    )
}

// ── Missions actives par mois ──────────────────────────────────────────────────

interface ActiveTooltipProps {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
}

function MissionsActiveTooltip({ active, payload, label }: ActiveTooltipProps) {
    if (!active || !payload?.length) return null
    const count = payload[0].value
    return (
        <Paper elevation={4} sx={{ p: 1.5, borderRadius: 2, minWidth: 140 }}>
            <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
                {label}
            </Typography>
            <Typography variant="caption" fontWeight={700} color="info.main">
                {count} mission{count > 1 ? 's' : ''} en cours
            </Typography>
        </Paper>
    )
}

function MissionsActivePerMonthSection() {
    const theme = useTheme()
    const { data, isLoading, isError } = useMissionsActivePerMonth()

    if (isLoading) return <CircularProgress size={24} />
    if (isError || !data) return <Alert severity="error">Erreur missions en cours</Alert>

    const chartData = data.points.map((p) => ({ name: p.label, 'En cours': p.count }))
    const maxCount = Math.max(...data.points.map((p) => p.count), 1)
    // mois courant = dernier point
    const currentIdx = data.points.length - 1

    return (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                        Missions en cours par mois
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Projets actifs (chevauchant le mois) — 12 derniers mois
                    </Typography>
                </Box>
                <Chip
                    label={`${data.points[currentIdx]?.count ?? 0} ce mois`}
                    size="small"
                    sx={{
                        bgcolor: alpha(theme.palette.info.main, 0.12),
                        color: 'info.main',
                        fontWeight: 700,
                    }}
                />
            </Stack>

            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={48}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={[0, Math.ceil(maxCount * 1.2) || 1]}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                    />
                    <Tooltip content={<MissionsActiveTooltip />} cursor={{ fill: alpha(theme.palette.info.main, 0.06) }} />
                    <Bar dataKey="En cours" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {chartData.map((_entry, idx) => (
                            <Cell
                                key={idx}
                                fill={
                                    idx === currentIdx
                                        ? theme.palette.info.main
                                        : alpha(theme.palette.info.main, 0.5)
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
    return (
        <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={700} mb={0.5}>
                Tableau de bord
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                Vue d'ensemble du pipeline et des prévisions
            </Typography>

            <Stack spacing={4}>
                <PipelineSection />
                <Divider />
                <ForecastSection />
                <Divider />
                <MissionsPerMonthSection />
                <Divider />
                <MissionsActivePerMonthSection />
            </Stack>
        </Box>
    )
}
