'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface EditableImageProps {
    src: string
    alt: string
    onChange: (newSrc: string) => void
    className?: string
    submissionId: string
}

export default function EditableImage({
    src,
    alt,
    onChange,
    className = '',
    submissionId
}: EditableImageProps) {
    const [isHovering, setIsHovering] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file')
            return
        }

        // Validate file size (max 10MB) — matches server-side cap in
        // /api/upload-image so the client never optimistically rejects a
        // file the server would accept.
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image size must be less than 10MB')
            return
        }

        setIsUploading(true)
        const uploadToast = toast.loading('Uploading image...')

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('submissionId', submissionId)

            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) throw new Error('Upload failed')

            const data = await response.json()
            onChange(data.url)
            toast.success('Image uploaded successfully!', { id: uploadToast })
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload image', { id: uploadToast })
        } finally {
            setIsUploading(false)
        }
    }

    const handleRemove = () => {
        if (confirm('Remove this image?')) {
            onChange('')
        }
    }

    return (
        <div
            className={`relative ${className}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <img src={src} alt={alt} className="w-full h-full object-cover" />

            {/* Overlay Controls */}
            {(isHovering || isUploading) && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-2 transition-opacity">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
                        title="Replace image"
                    >
                        {isUploading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Upload className="w-5 h-5" />
                        )}
                    </button>
                    {src && (
                        <button
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                            title="Remove image"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}

            {/* File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Empty State */}
            {!src && !isHovering && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
            )}
        </div>
    )
}
