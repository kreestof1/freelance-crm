import React from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

interface TagsInputProps {
    value: string[]
    onChange: (tags: string[]) => void
    label?: string
    placeholder?: string
    suggestions?: string[]
    disabled?: boolean
    error?: boolean
    helperText?: string
}

/**
 * Input de tags libre : l'utilisateur tape un tag et valide avec Entrée ou virgule.
 * Des suggestions optionnelles peuvent être proposées via `suggestions`.
 */
export function TagsInput({
    value,
    onChange,
    label = 'Tags',
    placeholder = 'Ajouter un tag…',
    suggestions = [],
    disabled = false,
    error = false,
    helperText,
}: TagsInputProps) {
    const handleChange = (_event: React.SyntheticEvent, newValue: string[]) => {
        // Normaliser : trim + minuscules
        onChange(newValue.map((t) => t.trim().toLowerCase()).filter(Boolean))
    }

    return (
        <Autocomplete
            multiple
            freeSolo
            options={suggestions}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            renderTags={(tagValue, getTagProps) =>
                tagValue.map((option, index) => {
                    const { key, ...rest } = getTagProps({ index })
                    return <Chip key={key} label={option} size="small" {...rest} />
                })
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    error={error}
                    helperText={helperText}
                    size="small"
                />
            )}
        />
    )
}
