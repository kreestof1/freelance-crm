import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
    colorSchemes: {
        light: {
            palette: {
                primary: {
                    main: '#1976d2',
                },
                secondary: {
                    main: '#9c27b0',
                },
                background: {
                    default: '#f5f5f5',
                    paper: '#ffffff',
                },
            },
        },
        dark: {
            palette: {
                primary: {
                    main: '#90caf9',
                },
                secondary: {
                    main: '#ce93d8',
                },
                background: {
                    default: '#121212',
                    paper: '#1e1e1e',
                },
            },
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700 },
        h2: { fontWeight: 600 },
        h3: { fontWeight: 600 },
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
                },
            },
        },
    },
})
