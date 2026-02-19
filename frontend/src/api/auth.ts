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

    refresh: () =>
        apiClient.post<TokenResponse>('/auth/refresh'),

    me: () =>
        apiClient.get<UserResponse>('/auth/me'),
}
