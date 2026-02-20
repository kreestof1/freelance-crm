import React, { useCallback, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    MenuItem,
    Paper,
    Stack,
    Step as MuiStep,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { contactsApi, useImportContactsCsv, type CsvColumnMapping } from '@/api/contacts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportCsvWizardProps {
    open: boolean
    onClose: () => void
}

type WizardStep = 'upload' | 'mapping' | 'result'

const STEPS = ['Fichier', 'Colonnes', 'Résultat']

/** All backend fields the user can map a CSV column to */
const FIELD_OPTIONS = [
    { value: '', label: '— Ignorer —' },
    { value: 'first_name', label: 'Prénom' },
    { value: 'last_name', label: 'Nom' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'position', label: 'Poste' },
    { value: 'company_name', label: 'Entreprise' },
    { value: 'tags', label: 'Tags (virgules)' },
    { value: 'notes', label: 'Notes' },
]

const STEP_INDEX: Record<WizardStep, number> = { upload: 0, mapping: 1, result: 2 }

// ── Step 1: File Upload ───────────────────────────────────────────────────────

function UploadStep({
    onDetect,
}: {
    onDetect: (file: File, mapping: CsvColumnMapping) => void
}) {
    const [detecting, setDetecting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState(false)

    const processFile = useCallback(
        async (file: File) => {
            if (!file.name.match(/\.(csv|txt)$/i)) {
                setError('Fichier CSV attendu (.csv ou .txt)')
                return
            }
            setError(null)
            setDetecting(true)
            try {
                const mapping = await contactsApi.detectCsvMapping(file)
                onDetect(file, mapping)
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Erreur lors de la détection'
                setError(msg)
            } finally {
                setDetecting(false)
            }
        },
        [onDetect],
    )

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }

    return (
        <Stack spacing={3} alignItems="center" py={2}>
            <Paper
                variant="outlined"
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                sx={{
                    width: '100%',
                    p: 4,
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: dragOver ? 'primary.main' : 'divider',
                    bgcolor: dragOver ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
                component="label"
                htmlFor="csv-file-input"
            >
                <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,.txt"
                    hidden
                    onChange={handleInputChange}
                />
                {detecting ? (
                    <Stack spacing={1} alignItems="center">
                        <CircularProgress size={32} />
                        <Typography color="text.secondary">Analyse en cours…</Typography>
                    </Stack>
                ) : (
                    <Stack spacing={1} alignItems="center">
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                        <Typography variant="body1">Glissez votre fichier CSV ici</Typography>
                        <Typography variant="caption" color="text.secondary">
                            ou cliquez pour parcourir (max 5 Mo, UTF-8 / Latin-1 acceptés)
                        </Typography>
                    </Stack>
                )}
            </Paper>
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
        </Stack>
    )
}

// ── Step 2: Column Mapping ────────────────────────────────────────────────────

function MappingStep({
    csvColumns,
    mapping,
    sampleRows,
    onMappingChange,
}: {
    csvColumns: string[]
    mapping: Record<string, string>
    sampleRows: Record<string, string>[]
    onMappingChange: (col: string, field: string) => void
}) {
    return (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                Associez chaque colonne CSV à un champ du contact. Les colonnes marquées comme «&nbsp;Ignorer&nbsp;» ne seront pas importées.
            </Typography>

            {/* Mapping selectors */}
            <Stack spacing={1}>
                {csvColumns.map((col) => (
                    <Stack key={col} direction="row" spacing={2} alignItems="center">
                        <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}>{col}</Typography>
                        <TextField
                            select
                            size="small"
                            value={mapping[col] ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onMappingChange(col, e.target.value)}
                            sx={{ flex: 2 }}
                        >
                            {FIELD_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                ))}
            </Stack>

            <Divider />

            {/* Sample preview */}
            {sampleRows.length > 0 && (
                <>
                    <Typography variant="caption" color="text.secondary">Aperçu (3 premières lignes)</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    {csvColumns.map((col) => (
                                        <TableCell key={col} sx={{ fontFamily: 'monospace', fontSize: 12 }}>{col}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sampleRows.slice(0, 3).map((row, i) => (
                                    <TableRow key={i}>
                                        {csvColumns.map((col) => (
                                            <TableCell key={col} sx={{ fontSize: 12 }}>{row[col] ?? ''}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}
        </Stack>
    )
}

// ── Step 3: Result ────────────────────────────────────────────────────────────

function ResultStep({
    success,
    errors,
}: {
    success: number
    errors: { line: number; message: string }[]
}) {
    return (
        <Stack spacing={2}>
            <Alert severity={errors.length === 0 ? 'success' : 'warning'}>
                {success} contact{success !== 1 ? 's' : ''} importé{success !== 1 ? 's' : ''} avec succès.
                {errors.length > 0 && ` ${errors.length} ligne(s) ignorée(s).`}
            </Alert>
            {errors.length > 0 && (
                <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
                    {errors.map((e, i) => (
                        <Alert key={i} severity="error" sx={{ mb: 0.5, py: 0.25 }}>
                            Ligne {e.line} : {e.message}
                        </Alert>
                    ))}
                </Box>
            )}
        </Stack>
    )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function ImportCsvWizard({ open, onClose }: ImportCsvWizardProps) {
    const [step, setStep] = useState<WizardStep>('upload')
    const [file, setFile] = useState<File | null>(null)
    const [csvMapping, setCsvMapping] = useState<CsvColumnMapping | null>(null)
    const [userMapping, setUserMapping] = useState<Record<string, string>>({})
    const [allOrNothing] = useState(false)

    const importCsv = useImportContactsCsv()

    const handleDetect = (detectedFile: File, detection: CsvColumnMapping) => {
        setFile(detectedFile)
        setCsvMapping(detection)
        setUserMapping(detection.detected_mapping)
        setStep('mapping')
    }

    const handleMappingChange = (col: string, field: string) => {
        setUserMapping((prev: Record<string, string>) => ({ ...prev, [col]: field }))
    }

    const handleImport = async () => {
        if (!file) return
        // Remove empty/ignored mappings
        const cleaned = Object.fromEntries(
            Object.entries(userMapping).filter(([, v]) => v !== '')
        )
        const result = await importCsv.mutateAsync({
            file,
            column_mapping: cleaned,
            all_or_nothing: allOrNothing,
        })
        setStep('result')
        return result
    }

    const handleClose = () => {
        setStep('upload')
        setFile(null)
        setCsvMapping(null)
        setUserMapping({})
        onClose()
    }

    const csvColumns = csvMapping ? Object.keys(csvMapping.detected_mapping) : []
    const importResult = importCsv.data

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Importer des contacts CSV</DialogTitle>

            <DialogContent>
                <Stepper activeStep={STEP_INDEX[step]} sx={{ mb: 3 }}>
                    {STEPS.map((label) => (
                        <MuiStep key={label}>
                            <StepLabel>{label}</StepLabel>
                        </MuiStep>
                    ))}
                </Stepper>

                {step === 'upload' && <UploadStep onDetect={handleDetect} />}

                {step === 'mapping' && csvMapping && (
                    <MappingStep
                        csvColumns={csvColumns}
                        mapping={userMapping}
                        sampleRows={csvMapping.sample_rows}
                        onMappingChange={handleMappingChange}
                    />
                )}

                {step === 'result' && importResult && (
                    <ResultStep success={importResult.success} errors={importResult.errors} />
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>{step === 'result' ? 'Fermer' : 'Annuler'}</Button>

                {step === 'mapping' && (
                    <>
                        <Button onClick={() => setStep('upload')} variant="outlined">Retour</Button>
                        <Button
                            onClick={handleImport}
                            variant="contained"
                            disabled={importCsv.isPending}
                            startIcon={importCsv.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                            Importer
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}
