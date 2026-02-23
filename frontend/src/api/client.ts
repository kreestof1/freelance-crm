import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
})

// Injecter le token Bearer sur chaque requête
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    // Pour les requêtes multipart (FormData), supprimer le Content-Type par défaut
    // afin que le navigateur puisse le définir lui-même avec le boundary correct.
    // Sans ça, axios 1.x sérialise la FormData en JSON (FormDataSerializer.toJSON)
    // à cause du default "Content-Type: application/json", ce qui brise l'upload.
    if (config.data instanceof FormData) {
        delete (config.headers as Record<string, unknown>)['Content-Type']
    }
    return config
})

// Intercepteur 401 → tentative de refresh
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            if (isRefreshing) {
                // Attendre la fin du refresh en cours
                return new Promise((resolve) => {
                    refreshQueue.push((token: string) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${token}`
                        }
                        resolve(apiClient(originalRequest))
                    })
                })
            }

            isRefreshing = true
            try {
                const refreshToken = useAuthStore.getState().refreshToken
                if (!refreshToken) throw new Error('no_refresh_token')
                const refreshResp = await axios.post(
                    `${BASE_URL}/auth/refresh`,
                    { refresh_token: refreshToken },
                    { withCredentials: true },
                )
                const { access_token, refresh_token } = refreshResp.data
                useAuthStore.getState().setTokens(access_token, useAuthStore.getState().user!, refresh_token)

                // Débloquer les requêtes en attente
                refreshQueue.forEach((cb) => cb(access_token))
                refreshQueue = []

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${access_token}`
                }
                return apiClient(originalRequest)
            } catch {
                useAuthStore.getState().clearAuth()
                window.location.href = '/login'
                return Promise.reject(error)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    },
)

export default apiClient
