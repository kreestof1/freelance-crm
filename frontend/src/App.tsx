import { RouterProvider } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { router } from './router'
import { theme } from './theme'

export default function App() {
    return (
        <ThemeProvider theme={theme} defaultMode="light">
            <CssBaseline />
            <RouterProvider router={router} />
        </ThemeProvider>
    )
}
