import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoginPage } from '@/features/auth/LoginPage'
import { MainLayout } from '@/components/layout/MainLayout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

/** Guard : redirige vers /login si non authentifié */
function RequireAuth() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

/** Guard : redirige vers / si déjà authentifié */
function PublicOnly() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />
}

export const router = createBrowserRouter([
    {
        element: <PublicOnly />,
        children: [
            { path: '/login', element: <LoginPage /> },
        ],
    },
    {
        element: <RequireAuth />,
        children: [
            {
                element: <MainLayout />,
                children: [
                    { path: '/', element: <DashboardPage /> },
                    { path: '/leads', lazy: () => import('@/features/leads/LeadsPage').then(m => ({ Component: m.LeadsPage })) },
                    { path: '/contacts', lazy: () => import('@/features/contacts/ContactsPage').then(m => ({ Component: m.ContactsPage })) },
                    { path: '/companies', lazy: () => import('@/features/companies/CompaniesPage').then(m => ({ Component: m.CompaniesPage })) },
                    { path: '/deals', lazy: () => import('@/features/deals/DealsPage').then(m => ({ Component: m.DealsPage })) },
                    { path: '/projects', lazy: () => import('@/features/projects/ProjectsPage').then(m => ({ Component: m.ProjectsPage })) },
                    { path: '/activities', lazy: () => import('@/features/activities/ActivitiesPage').then(m => ({ Component: m.ActivitiesPage })) },
                    { path: '/documents', lazy: () => import('@/features/documents/DocumentsPage').then(m => ({ Component: m.DocumentsPage })) },
                ],
            },
        ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
])
