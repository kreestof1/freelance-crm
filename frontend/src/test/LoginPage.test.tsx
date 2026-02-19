import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'

describe('LoginPage', () => {
    it('affiche le formulaire de connexion', () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        )
        expect(screen.getByRole('button', { name: /auth\.login/i })).toBeInTheDocument()
    })
})
