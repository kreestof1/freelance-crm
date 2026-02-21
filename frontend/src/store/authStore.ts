import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: string
    email: string
    name: string
    role: string
}

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean
    setTokens: (accessToken: string, user: User, refreshToken?: string) => void
    clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,

            setTokens: (accessToken: string, user: User, refreshToken?: string) =>
                set((s) => ({
                    accessToken,
                    user,
                    isAuthenticated: true,
                    refreshToken: refreshToken ?? s.refreshToken,
                })),

            clearAuth: () =>
                set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
        }),
        {
            name: 'crm-auth',
            // Persister le refresh token (access token est court-livé, non persisté)
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                refreshToken: state.refreshToken,
            }),
        },
    ),
)
