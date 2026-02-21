import apiClient from './client'

export interface LoginPayload {
    email: string
    password: string
}

export interface TokenResponse {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
}

export interface UserResponse {
    id: string
    email: string
    name: string
    role: string
}

export const authApi = {
    login: (payload: LoginPayload) =>
        apiClient.post<TokenResponse>('/auth/login', payload),

    refresh: (refreshToken: string) =>
        apiClient.post<TokenResponse>('/auth/refresh', { refresh_token: refreshToken }),

    // token optionnel : utile juste après le login, avant que le store soit alimenté
    me: (token?: string) =>
        apiClient.get<UserResponse>('/auth/me', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
}
