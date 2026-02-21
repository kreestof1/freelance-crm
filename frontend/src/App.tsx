import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material'
import { router } from './router'
import { theme } from './theme'
import { useAuthStore } from './store/authStore'
import { authApi } from './api/auth'

/**
 * Renouvèle silencieusement le token d'accès au démarrage si le refresh token
 * est disponible mais que l'access token est absent (ex : rechargement de page).
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
    const { accessToken, refreshToken, isAuthenticated, setTokens, clearAuth } = useAuthStore()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const init = async () => {
            if (isAuthenticated && !accessToken && refreshToken) {
                try {
                    const resp = await authApi.refresh(refreshToken)
                    const { access_token, refresh_token } = resp.data
                    const meResp = await authApi.me(access_token)
                    setTokens(access_token, meResp.data, refresh_token)
                } catch {
                    clearAuth()
                }
            }
            setReady(true)
        }
        init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!ready) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        )
    }

    return <>{children}</>
}

export default function App() {
    return (
        <ThemeProvider theme={theme} defaultMode="light">
            <CssBaseline />
            <AuthInitializer>
                <RouterProvider router={router} />
            </AuthInitializer>
        </ThemeProvider>
    )
}
