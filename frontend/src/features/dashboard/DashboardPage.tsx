import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export function DashboardPage() {
    const { t } = useTranslation()
    return <Typography variant="h4">{t('nav.dashboard')}</Typography>
}
