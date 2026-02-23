import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
    AppBar,
    Box,
    Drawer,
    IconButton,
    Link,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    Tooltip,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import BusinessIcon from '@mui/icons-material/Business'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WorkIcon from '@mui/icons-material/Work'
import EventNoteIcon from '@mui/icons-material/EventNote'
import FolderIcon from '@mui/icons-material/Folder'
import LogoutIcon from '@mui/icons-material/Logout'
import SearchIcon from '@mui/icons-material/Search'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { NotificationCenter } from '@/components/common/NotificationCenter'

const DRAWER_WIDTH = 240

const navItems = [
    { to: '/', icon: <DashboardIcon />, labelKey: 'nav.dashboard' },
    { to: '/leads', icon: <PersonAddIcon />, labelKey: 'nav.leads' },
    { to: '/contacts', icon: <PeopleIcon />, labelKey: 'nav.contacts' },
    { to: '/companies', icon: <BusinessIcon />, labelKey: 'nav.companies' },
    { to: '/deals', icon: <TrendingUpIcon />, labelKey: 'nav.deals' },
    { to: '/projects', icon: <WorkIcon />, labelKey: 'nav.projects' },
    { to: '/activities', icon: <EventNoteIcon />, labelKey: 'nav.activities' },
    { to: '/documents', icon: <FolderIcon />, labelKey: 'nav.documents' },
]

export function MainLayout() {
    const { t } = useTranslation()
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const [mobileOpen, setMobileOpen] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const clearAuth = useAuthStore((s) => s.clearAuth)
    const navigate = useNavigate()

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setSearchOpen(true)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleLogout = () => {
        clearAuth()
        navigate('/login', { replace: true })
    }

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar>
                <Typography variant="h6" fontWeight={700} color="primary">
                    CRM Freelance
                </Typography>
            </Toolbar>
            <List sx={{ flex: 1 }}>
                {navItems.map((item) => (
                    <ListItemButton
                        key={item.to}
                        component={NavLink}
                        to={item.to}
                        end={item.to === '/'}
                        sx={{
                            '&.active': {
                                bgcolor: 'primary.light',
                                color: 'primary.contrastText',
                                '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                            },
                        }}
                        onClick={() => setMobileOpen(false)}
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={t(item.labelKey)} />
                    </ListItemButton>
                ))}
            </List>
            <Box sx={{ p: 1 }}>
                <ListItemButton onClick={handleLogout}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText primary={t('auth.logout')} />
                </ListItemButton>
                <Box sx={{ px: 1, pb: 1, pt: 0.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled" display="block">
                        &copy; {new Date().getFullYear()}{' '}
                        <Link
                            href="https://www.jalex.fr"
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            color="text.disabled"
                            sx={{ fontWeight: 500 }}
                        >
                            Jalex Consulting
                        </Link>
                    </Typography>
                </Box>
            </Box>
        </Box>
    )

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                sx={{ zIndex: (t) => t.zIndex.drawer + 1, display: { md: 'none' } }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Ouvrir le menu"
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                        CRM Freelance
                    </Typography>
                    <Tooltip title="Rechercher (Ctrl+K)">
                        <IconButton color="inherit" onClick={() => setSearchOpen(true)}>
                            <SearchIcon />
                        </IconButton>
                    </Tooltip>
                    <NotificationCenter />
                </Toolbar>
            </AppBar>

            {/* Drawer desktop permanent */}
            <Drawer
                variant={isMobile ? 'temporary' : 'permanent'}
                open={isMobile ? mobileOpen : true}
                onClose={() => setMobileOpen(false)}
                sx={{
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
                }}
                ModalProps={{ keepMounted: true }}
            >
                {drawer}
            </Drawer>

            {/* Contenu principal */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    mt: { xs: 8, md: 0 },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    bgcolor: 'background.default',
                    minHeight: '100vh',
                }}
            >
                <Outlet />
            </Box>

            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        </Box>
    )
}
