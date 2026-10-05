"use client"

import { useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react"

import { Icon } from "@/components/r1"
import { extensionFor, fetchUncached } from "@/lib/mediaZip"

interface PhotoLightboxProps {
    photos: string[]
    initialIndex?: number
    onClose: () => void
}

/**
 * The full-screen photo viewer (board Review: the owner's photos open here).
 *
 * A native modal <dialog>, like the kit overlays: it takes focus when it opens
 * (so the arrow keys work straight away), Esc closes it, the page behind is
 * inert, and focus goes back to the photo that opened it. Mounted only while
 * open; the parent unmounts it to close.
 */
export function PhotoLightbox({ photos, initialIndex = 0, onClose }: PhotoLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const ref = useRef<HTMLDialogElement>(null)

    useLayoutEffect(() => {
        const el = ref.current
        if (el && !el.open) el.showModal()
        return () => {
            if (el?.open) el.close()
        }
    }, [])

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') goToPrevious()
        if (e.key === 'ArrowRight') goToNext()
    }

    const handleDownload = async () => {
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
    }

    const round = "inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-r1-paper/10 p-0 text-r1-paper hover:bg-r1-paper/20"

    return (
        <dialog
            ref={ref}
            aria-label="Photo viewer"
            className="r1 fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-r1-ink/95 p-0 text-r1-paper backdrop:bg-transparent"
            // Esc: the platform's cancel. Let the parent unmount us instead of
            // closing behind React's back.
            onCancel={(e) => {
                e.preventDefault()
                onClose()
            }}
            onKeyDown={handleKeyDown}
            // A click on the dark ground (not the photo or a button) closes.
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            {/* Top-right controls: Download + Close */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-3">
                <button type="button" onClick={handleDownload} className={round} title="Download photo" aria-label="Download photo">
                    <Icon icon={Download} size={18} />
                </button>
                <button type="button" onClick={onClose} className={round} title="Close" aria-label="Close photo viewer">
                    <Icon icon={X} size={18} />
                </button>
            </div>

            {photos.length > 1 && (
                <button
                    type="button"
                    onClick={goToPrevious}
                    className={`${round} absolute left-4 top-1/2 z-10 -translate-y-1/2`}
                    aria-label="Previous photo"
                >
                    <Icon icon={ChevronLeft} size={20} />
                </button>
            )}

            {/* The photo. Clicks on it never reach the ground's close handler:
                its target is the image, not the dialog. */}
            <div className="absolute inset-x-16 bottom-16 top-16 sm:inset-x-20">
                <Image
                    src={photos[currentIndex]}
                    alt={`Photo ${currentIndex + 1} of ${photos.length}`}
                    fill
                    sizes="100vw"
                    className="object-contain"
                />
            </div>

            {photos.length > 1 && (
                <button
                    type="button"
                    onClick={goToNext}
                    className={`${round} absolute right-4 top-1/2 z-10 -translate-y-1/2`}
                    aria-label="Next photo"
                >
                    <Icon icon={ChevronRight} size={20} />
                </button>
            )}

            {/* Counter */}
            <div className="t-num absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-r1-ink/60 px-4 py-2 text-[13px] leading-[18px] text-r1-paper" aria-live="polite">
                {currentIndex + 1} of {photos.length}
            </div>
        </dialog>
    )
}
