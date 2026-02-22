import { useRef, useState } from 'react'
import {
    Badge,
    Box,
    Chip,
    Divider,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Popover,
    Tooltip,
    Typography,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useUpcomingActivities, type ActivityType } from '@/api/activities'

const TYPE_COLOR: Record<ActivityType, 'primary' | 'info' | 'warning' | 'success'> = {
    Appel: 'primary',
    Email: 'info',
    Tâche: 'warning',
    RDV: 'success',
}

export function NotificationCenter() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const anchorRef = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)

    const { data, refetch } = useUpcomingActivities(48)
    const upcoming = data?.items ?? []
    const count = upcoming.length

    const handleOpen = () => {
        refetch()
        setOpen(true)
    }

    const handleClose = () => setOpen(false)

    const handleNavigate = () => {
        navigate('/activities')
        handleClose()
    }

    return (
        <>
            <Tooltip title={t('notifications.title', 'Rappels à venir')}>
                <IconButton color="inherit" ref={anchorRef} onClick={handleOpen}>
                    <Badge badgeContent={count > 0 ? count : undefined} color="error" max={9}>
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorRef.current}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ sx: { width: 360, maxHeight: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
            >
                <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                        {t('notifications.title', 'Rappels à venir')}
                    </Typography>
                    {count > 0 && (
                        <Chip label={count} size="small" color="error" />
                    )}
                </Box>
                <Divider />

                {count === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <NotificationsIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                            {t('notifications.empty', 'Aucun rappel à venir')}
                        </Typography>
                    </Box>
                ) : (
                    <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
                        {upcoming.map((activity) => {
                            const whenStr = (() => {
                                try { return format(parseISO(activity.when), 'd MMM, HH:mm', { locale: fr }) }
                                catch { return activity.when }
                            })()
                            const reminderStr = activity.reminder_at ? (() => {
                                try { return format(parseISO(activity.reminder_at), 'd MMM HH:mm', { locale: fr }) }
                                catch { return '' }
                            })() : ''

                            return (
                                <ListItemButton
                                    key={activity.id}
                                    onClick={handleNavigate}
                                    sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={t(`activities.type.${activity.type}`)}
                                                    size="small"
                                                    color={TYPE_COLOR[activity.type]}
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                                />
                                                <Typography variant="body2" fontWeight={500} noWrap>
                                                    {activity.outcome || activity.notes || `${t(`activities.type.${activity.type}`)} prévu`}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Typography variant="caption" color="text.secondary">
                                                {t('activities.whenLabel')} : {whenStr}
                                                {reminderStr && ` · rappel ${reminderStr}`}
                                            </Typography>
                                        }
                                    />
                                </ListItemButton>
                            )
                        })}
                    </List>
                )}

                {count > 0 && (
                    <>
                        <Divider />
                        <Box sx={{ p: 1, textAlign: 'center' }}>
                            <Typography
                                variant="caption"
                                color="primary"
                                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                onClick={handleNavigate}
                            >
                                {t('notifications.seeAll', 'Voir toutes les activités')}
                            </Typography>
                        </Box>
                    </>
                )}
            </Popover>
        </>
    )
}
