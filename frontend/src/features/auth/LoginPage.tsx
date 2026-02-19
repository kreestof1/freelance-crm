import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    TextField,
    Typography,
    Alert,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const setTokens = useAuthStore((s) => s.setTokens)
    const [error, setError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginForm) => {
        setError(null)
        try {
            const loginResp = await authApi.login(data)
            const { access_token } = loginResp.data

            // Récupérer les infos utilisateur
            const meResp = await authApi.me()
            setTokens(access_token, meResp.data)

            // Stocker le refresh token dans un cookie httpOnly via le backend
            navigate('/', { replace: true })
        } catch {
            setError(t('auth.invalidCredentials'))
        }
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                p: 2,
            }}
        >
            <Card sx={{ maxWidth: 440, width: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom align="center">
                        {t('auth.loginTitle')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                        {t('auth.loginSubtitle')}
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box
                        component="form"
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                        <TextField
                            label={t('auth.email')}
                            type="email"
                            autoComplete="email"
                            autoFocus
                            fullWidth
                            {...register('email')}
                            error={!!errors.email}
                            helperText={errors.email?.message}
                        />
                        <TextField
                            label={t('auth.password')}
                            type="password"
                            autoComplete="current-password"
                            fullWidth
                            {...register('password')}
                            error={!!errors.password}
                            helperText={errors.password?.message}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={isSubmitting}
                            sx={{ mt: 1 }}
                        >
                            {isSubmitting ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                t('auth.login')
                            )}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    )
}
