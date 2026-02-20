import React from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TableSortLabel,
    Paper,
    Skeleton,
    Typography,
    Box,
    Checkbox,
} from '@mui/material'

export type SortDirection = 'asc' | 'desc'

export interface ColumnDef<T> {
    key: string
    header: string
    /** Render override. Falls back to row[key] as string. */
    render?: (row: T) => React.ReactNode
    sortable?: boolean
    width?: string | number
    align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T extends { id: string }> {
    columns: ColumnDef<T>[]
    rows: T[]
    total: number
    page: number           // 0-based (MUI convention)
    pageSize: number
    loading?: boolean
    sortBy?: string
    sortDir?: SortDirection
    selectable?: boolean
    selected?: string[]
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    onSort?: (key: string, dir: SortDirection) => void
    onSelectionChange?: (ids: string[]) => void
    onRowClick?: (row: T) => void
    emptyMessage?: string
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]
const SKELETON_ROWS = 5

export function DataTable<T extends { id: string }>({
    columns,
    rows,
    total,
    page,
    pageSize,
    loading = false,
    sortBy,
    sortDir = 'asc',
    selectable = false,
    selected = [],
    onPageChange,
    onPageSizeChange,
    onSort,
    onSelectionChange,
    onRowClick,
    emptyMessage = 'Aucune donnée',
}: DataTableProps<T>) {
    const handleSort = (key: string) => {
        if (!onSort) return
        const newDir: SortDirection =
            sortBy === key && sortDir === 'asc' ? 'desc' : 'asc'
        onSort(key, newDir)
    }

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return
        onSelectionChange(event.target.checked ? rows.map((r) => r.id) : [])
    }

    const handleSelectOne = (id: string) => {
        if (!onSelectionChange) return
        if (selected.includes(id)) {
            onSelectionChange(selected.filter((s) => s !== id))
        } else {
            onSelectionChange([...selected, id])
        }
    }

    const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id))
    const someSelected = rows.some((r) => selected.includes(r.id))

    return (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <TableContainer>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {selectable && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={someSelected && !allSelected}
                                        onChange={handleSelectAll}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            {columns.map((col) => (
                                <TableCell
                                    key={col.key}
                                    align={col.align ?? 'left'}
                                    style={{ width: col.width }}
                                    sortDirection={sortBy === col.key ? sortDir : false}
                                >
                                    {col.sortable && onSort ? (
                                        <TableSortLabel
                                            active={sortBy === col.key}
                                            direction={sortBy === col.key ? sortDir : 'asc'}
                                            onClick={() => handleSort(col.key)}
                                        >
                                            {col.header}
                                        </TableSortLabel>
                                    ) : (
                                        col.header
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {loading
                            ? Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                                <TableRow key={idx}>
                                    {selectable && (
                                        <TableCell padding="checkbox">
                                            <Skeleton variant="rectangular" width={20} height={20} />
                                        </TableCell>
                                    )}
                                    {columns.map((col) => (
                                        <TableCell key={col.key}>
                                            <Skeleton variant="text" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                            : rows.length === 0
                                ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length + (selectable ? 1 : 0)}
                                            align="center"
                                            sx={{ py: 6 }}
                                        >
                                            <Typography color="text.secondary">{emptyMessage}</Typography>
                                        </TableCell>
                                    </TableRow>
                                )
                                : rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        hover
                                        selected={selected.includes(row.id)}
                                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                                        sx={onRowClick ? { cursor: 'pointer' } : undefined}
                                    >
                                        {selectable && (
                                            <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selected.includes(row.id)}
                                                    onChange={() => handleSelectOne(row.id)}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        {columns.map((col) => (
                                            <TableCell key={col.key} align={col.align ?? 'left'}>
                                                {col.render
                                                    ? col.render(row)
                                                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box>
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    rowsPerPage={pageSize}
                    rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                    onPageChange={(_e, p) => onPageChange(p)}
                    onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
                    labelRowsPerPage="Lignes / page"
                    labelDisplayedRows={({ from, to, count }) =>
                        `${from}–${to} sur ${count !== -1 ? count : `plus de ${to}`}`
                    }
                />
            </Box>
        </Paper>
    )
}
