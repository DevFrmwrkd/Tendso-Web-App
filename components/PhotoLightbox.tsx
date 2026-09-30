"use client"

import { useState } from "react"
import Image from "next/image"
import { extensionFor, fetchUncached } from "@/lib/mediaZip"

interface PhotoLightboxProps {
    photos: string[]
    initialIndex?: number
    onClose: () => void
}

export function PhotoLightbox({ photos, initialIndex = 0, onClose }: PhotoLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'ArrowLeft') goToPrevious()
        if (e.key === 'ArrowRight') goToNext()
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={onClose}
            onKeyDown={handleKeyDown}
            tabIndex={0}
        >
            {/* Top-right controls: Download + Close */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
                <button
                    onClick={async (e) => {
                        e.stopPropagation()
                        try {
                            // Uncached: the site preview has usually shown this photo already,
                            // and that cached copy has no CORS headers (see fetchUncached).
                            const res = await fetchUncached(fetch, photos[currentIndex])
                            if (!res.ok) throw new Error(`HTTP ${res.status}`)
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `photo-${currentIndex + 1}.${extensionFor(res.headers.get('content-type'), photos[currentIndex])}`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                        } catch {
                            window.open(photos[currentIndex], '_blank')
                        }
                    }}
                    className="text-white hover:text-gray-300 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                    title="Download photo"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-300 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Previous Button */}
            {photos.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        goToPrevious()
                    }}
                    className="absolute left-4 text-white hover:text-gray-300 z-10"
                >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Image */}
            <div
                className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative w-full h-full">
                    <Image
                        src={photos[currentIndex]}
                        alt={`Photo ${currentIndex + 1}`}
                        fill
                        className="object-contain"
                    />
                </div>
            </div>

            {/* Next Button */}
            {photos.length > 1 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        goToNext()
                    }}
                    className="absolute right-4 text-white hover:text-gray-300 z-10"
                >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                {currentIndex + 1} / {photos.length}
            </div>
        </div>
    )
}
