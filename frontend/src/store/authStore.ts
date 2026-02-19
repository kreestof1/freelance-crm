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
    isAuthenticated: boolean
    setTokens: (accessToken: string, user: User) => void
    clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,

            setTokens: (accessToken: string, user: User) =>
                set({ accessToken, user, isAuthenticated: true }),

            clearAuth: () =>
                set({ accessToken: null, user: null, isAuthenticated: false }),
        }),
        {
            name: 'crm-auth',
            // Ne persister que l'utilisateur, pas le access token (sécurité)
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        },
    ),
)
