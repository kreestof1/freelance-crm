import React from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    CircularProgress,
} from '@mui/material'

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    loading = false,
    danger = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={loading}>
                    {cancelLabel}
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={loading}
                    color={danger ? 'error' : 'primary'}
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
