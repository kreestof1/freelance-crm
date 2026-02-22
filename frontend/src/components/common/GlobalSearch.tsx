import { useEffect, useRef, useState } from 'react'
import {
    Box,
    Chip,
    Dialog,
    DialogContent,
    Divider,
    InputAdornment,
    List,
    ListItemButton,
    ListItemText,
    TextField,
    Typography,
    CircularProgress,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSearch, type SearchEntityType } from '@/api/search'

interface GlobalSearchProps {
    open: boolean
    onClose: () => void
}

const TYPE_COLOR: Record<SearchEntityType, 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error'> = {
    contact: 'primary',
    company: 'secondary',
    lead: 'info',
    deal: 'success',
    project: 'warning',
}

const TYPE_PATH: Record<SearchEntityType, (id: number) => string> = {
    contact: (id) => `/contacts/${id}`,
    company: (id) => `/companies/${id}`,
    lead: (_id) => `/leads`,
    deal: (_id) => `/deals`,
    project: (id) => `/projects/${id}`,
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [rawQuery, setRawQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    // Debounce
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(rawQuery), 300)
        return () => clearTimeout(timer)
    }, [rawQuery])

    // Reset focus when query changes
    useEffect(() => {
        setFocusedIndex(-1)
    }, [debouncedQuery])

    // Focus input when dialog opens / reset when closed
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50)
        } else {
            setRawQuery('')
            setDebouncedQuery('')
            setFocusedIndex(-1)
        }
    }, [open])

    const { data, isFetching } = useSearch(debouncedQuery)
    const hits = data?.hits ?? []

    // Flat list for keyboard navigation
    const flatHits = hits

    const handleSelect = (type: SearchEntityType, id: number) => {
        navigate(TYPE_PATH[type](id))
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { onClose(); return }
        if (flatHits.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = focusedIndex < flatHits.length - 1 ? focusedIndex + 1 : 0
            setFocusedIndex(next)
            scrollToItem(next)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = focusedIndex > 0 ? focusedIndex - 1 : flatHits.length - 1
            setFocusedIndex(prev)
            scrollToItem(prev)
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault()
            const hit = flatHits[focusedIndex]
            if (hit) handleSelect(hit.type, hit.id)
        }
    }

    const scrollToItem = (index: number) => {
        const list = listRef.current
        if (!list) return
        const item = list.querySelector(`[data-index="${index}"]`) as HTMLElement | null
        item?.scrollIntoView({ block: 'nearest' })
    }

    // Group hits by type
    const grouped = hits.reduce<Partial<Record<SearchEntityType, typeof hits>>>((acc, hit) => {
        if (!acc[hit.type]) acc[hit.type] = []
        acc[hit.type]!.push(hit)
        return acc
    }, {})
    const groupKeys = Object.keys(grouped) as SearchEntityType[]

    // Build a flat index map for highlighting
    const hitIndexMap = new Map(hits.map((h, i) => [`${h.type}-${h.id}`, i]))

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { mt: '10vh', maxHeight: '70vh', alignSelf: 'flex-start' } }}
        >
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <TextField
                        inputRef={inputRef}
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder={t('search.placeholder')}
                        value={rawQuery}
                        onChange={(e) => setRawQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    {isFetching ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        <SearchIcon fontSize="small" />
                                    )}
                                </InputAdornment>
                            ),
                            endAdornment: debouncedQuery.length > 0 && hits.length > 0 ? (
                                <InputAdornment position="end">
                                    <Typography variant="caption" color="text.disabled">
                                        ↑↓ Naviguer · ↵ Ouvrir
                                    </Typography>
                                </InputAdornment>
                            ) : undefined,
                        }}
                    />
                </Box>

                {debouncedQuery.length > 0 && (
                    <>
                        <Divider />
                        {hits.length === 0 && !isFetching ? (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <Typography color="text.secondary" variant="body2">
                                    {t('search.noResults')}
                                </Typography>
                            </Box>
                        ) : (
                            <List
                                dense
                                disablePadding
                                ref={listRef}
                                sx={{ overflow: 'auto', maxHeight: '50vh' }}
                            >
                                {groupKeys.map((type, gi) => (
                                    <Box key={type}>
                                        {gi > 0 && <Divider />}
                                        <Box sx={{ px: 2, py: 0.75 }}>
                                            <Chip
                                                label={t(`search.type.${type}`)}
                                                size="small"
                                                color={TYPE_COLOR[type]}
                                                variant="outlined"
                                            />
                                        </Box>
                                        {grouped[type]!.map((hit) => {
                                            const idx = hitIndexMap.get(`${hit.type}-${hit.id}`) ?? -1
                                            const isFocused = idx === focusedIndex
                                            return (
                                                <ListItemButton
                                                    key={`${hit.type}-${hit.id}`}
                                                    data-index={idx}
                                                    selected={isFocused}
                                                    onClick={() => handleSelect(hit.type, hit.id)}
                                                    onMouseEnter={() => setFocusedIndex(idx)}
                                                    sx={{ px: 3, py: 0.75 }}
                                                >
                                                    <ListItemText
                                                        primary={hit.title}
                                                        secondary={hit.excerpt || undefined}
                                                        secondaryTypographyProps={{
                                                            noWrap: true,
                                                            maxWidth: 360,
                                                        }}
                                                    />
                                                </ListItemButton>
                                            )
                                        })}
                                    </Box>
                                ))}
                            </List>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
