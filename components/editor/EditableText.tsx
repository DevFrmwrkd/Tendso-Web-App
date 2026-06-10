'use client'

import { useState, useRef, useEffect } from 'react'
import { Edit2, Check, X } from 'lucide-react'

interface EditableTextProps {
    value: string
    onChange: (value: string) => void
    className?: string
    placeholder?: string
    multiline?: boolean
    maxLength?: number
}

export default function EditableText({
    value,
    onChange,
    className = '',
    placeholder = 'Click to edit...',
    multiline = false,
    maxLength = 500
}: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value)
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleSave = () => {
        onChange(editValue)
        setIsEditing(false)
    }

    const handleCancel = () => {
        setEditValue(value)
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault()
            handleSave()
        }
        if (e.key === 'Escape') {
            handleCancel()
        }
    }

    if (isEditing) {
        return (
            <div className="relative group">
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`${className} border-2 border-blue-500 rounded px-2 py-1 w-full resize-none`}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        rows={3}
                    />
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={`${className} border-2 border-blue-500 rounded px-2 py-1 w-full`}
                        placeholder={placeholder}
                        maxLength={maxLength}
                    />
                )}
                <div className="absolute -right-20 top-0 flex gap-1">
                    <button
                        onClick={handleSave}
                        className="p-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                        title="Save"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleCancel}
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                        title="Cancel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    {editValue.length}/{maxLength}
                </div>
            </div>
        )
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={`${className} cursor-pointer hover:bg-blue-50 hover:outline hover:outline-2 hover:outline-blue-300 rounded px-2 py-1 relative group transition-all`}
        >
            {value || <span className="text-gray-400 italic">{placeholder}</span>}
            <Edit2 className="w-3 h-3 absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
    )
}
