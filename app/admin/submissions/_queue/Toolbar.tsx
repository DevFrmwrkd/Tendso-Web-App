"use client"

import { ArrowUpDown, Check, ChevronDown, Search, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

import { Button, cx, Icon } from "@/components/r1"

/*
 * The queue's toolbar controls (board Queue; ComponentKit "Search", "Menu").
 * Built here rather than taken from components/r1 because each needs one
 * thing the shared one does not have: the search box clears itself with a
 * button, and the sort menu is a set of radio items with a check on the
 * chosen one, not a list of actions.
 */

/** The search box: magnifier inside on the left, a clear button on the right once there is text. */
export function QueueSearch({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    className?: string
}) {
    const id = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    return (
        <div className={cx("t-input-wrap", className)}>
            <label className="sr-only" htmlFor={id}>
                Search submissions
            </label>
            <span className="t-ico-l">
                <Icon icon={Search} />
            </span>
            {/* The browser's own clear cross is hidden: the button below is the one clear control, in every browser. */}
            <input
                ref={inputRef}
                id={id}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                className="t-input pr-10 [&::-webkit-search-cancel-button]:appearance-none"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && (
                <Button
                    variant="ghost"
                    size="sm"
                    icon
                    className="absolute top-1 right-1 text-r1-ink-3 hover:text-r1-ink"
                    aria-label="Clear search"
                    onClick={() => {
                        onChange("")
                        inputRef.current?.focus()
                    }}
                >
                    <Icon icon={X} />
                </Button>
            )}
        </div>
    )
}

/**
 * "Sort: Oldest first". A menu of radio items: the chosen one is checked, and
 * picking one closes the menu. Esc, a click outside or Tab close it; the arrow
 * keys, Home and End move between the options. On a phone the trigger is the
 * sort icon alone (its label still names the order), so the two filter chips
 * and the sort share one line under the search box.
 */
export function SortMenu<K extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: readonly { key: K; label: string }[]
    value: K
    onChange: (value: K) => void
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const menuId = useId()
    const current = options.find((o) => o.key === value) ?? options[0]

    useEffect(() => {
        if (!open) return
        // Like a native select: the menu opens on the order in use.
        menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
        const onDown = (e: PointerEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener("pointerdown", onDown)
        return () => document.removeEventListener("pointerdown", onDown)
    }, [open])

    const close = (refocus: boolean) => {
        setOpen(false)
        if (refocus) wrapRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus()
    }

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!open) return
        if (e.key === "Escape") {
            e.preventDefault()
            close(true)
            return
        }
        if (e.key === "Tab") {
            setOpen(false)
            return
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return
        e.preventDefault()
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
        if (items.length === 0) return
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next =
            e.key === "Home"
                ? 0
                : e.key === "End"
                  ? items.length - 1
                  : e.key === "ArrowDown"
                    ? (i + 1) % items.length
                    : (i - 1 + items.length) % items.length
        items[next].focus()
    }

    return (
        <div ref={wrapRef} className={cx("t-menu-wrap", className)} onKeyDown={onKeyDown}>
            <Button
                className="w-10 px-0 sm:w-auto sm:px-4"
                aria-label={`Sort: ${current.label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((o) => !o)}
            >
                <Icon icon={ArrowUpDown} className="sm:hidden" />
                <span className="hidden sm:inline">Sort: {current.label}</span>
                <Icon icon={ChevronDown} className="hidden sm:block" />
            </Button>
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label="Sort by" className="t-menu w-[220px]">
                    {options.map((o) => {
                        const selected = o.key === value
                        return (
                            <button
                                key={o.key}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onClick={() => {
                                    onChange(o.key)
                                    close(true)
                                }}
                            >
                                {o.label}
                                {selected && (
                                    <span className="ml-auto flex text-r1-ink">
                                        <Icon icon={Check} />
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
