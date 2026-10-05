"use client"

import { Download, Trash2 } from "lucide-react"
import { useId } from "react"

import { Button, Card, Fold, Folds, Icon, Input, Status } from "@/components/r1"

export type StoreKey = "play" | "ios"
export type StoreLinks = Record<StoreKey, string>

/**
 * The App links tab (board SiteSettings), which used to be its own page at
 * /admin/app-release: the two store listings, and the clean-up for the APK
 * that page used to host.
 *
 * WHERE THE LINKS SHOW. The landing's old "Get the app" band and footer that
 * the board names are gone with the Round 1 landing; today the links are read
 * by the app section on /for-creators (its buttons and the Android QR), by
 * /otr (which sends a phone straight to its store), and by /api/download-apk
 * (old "download the APK" links now go to the Play listing). Nothing is
 * hardcoded anywhere: a blank field means that store is not offered.
 */
export function AppLinksPanel({
    links,
    errors,
    onChange,
    apk,
    onAskDeleteApk,
}: {
    links: StoreLinks
    /** Shown only after a Save was tried with a bad link, as the board does. */
    errors: Record<StoreKey, string | null>
    onChange: (key: StoreKey, value: string) => void
    /** The APK still recorded in storage, or null once there is none. */
    apk: { fileName: string | null } | null
    onAskDeleteApk: () => void
}) {
    return (
        <div className="flex flex-col gap-8">
            <Card pad className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                    <h2 className="t-h2">Store links</h2>
                    <p className="t-meta">
                        Used by the app section on For creators (its buttons and QR code), the OTR page and old APK download links. There is no
                        fallback: a blank field removes that store from the live site.
                    </p>
                </div>
                <StoreLinkField
                    label="Google Play link (Android)"
                    placeholder="https://play.google.com/store/apps/details?id=…"
                    help="Leave blank to hide the Google Play button."
                    value={links.play}
                    error={errors.play}
                    onChange={(v) => onChange("play", v)}
                />
                <StoreLinkField
                    label="App Store link (iOS)"
                    placeholder="https://apps.apple.com/app/…"
                    help="Leave blank to hide the App Store button."
                    value={links.ios}
                    error={errors.ios}
                    onChange={(v) => onChange("ios", v)}
                />
            </Card>

            {/* One-time clean-up. Renders only while an old APK release is
                still recorded, and goes away the moment it succeeds. */}
            {apk && (
                <Folds>
                    <Fold
                        title={
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                Old APK release
                                <Status tone="off" word="1 file still in storage" />
                            </span>
                        }
                    >
                        <div className="flex flex-col gap-4 pb-2">
                            <p className="t-body max-w-[640px]">
                                Direct APK downloads were retired when the app went on the stores. Nothing on the site links to this file any more; it
                                only takes up storage.
                            </p>
                            {apk.fileName && (
                                <div className="flex min-w-0 items-center gap-3 rounded-r1 border border-r1-line bg-r1-fill-2 px-4 py-3">
                                    <Icon icon={Download} className="flex-none text-r1-ink-3" />
                                    <span className="t-label">File</span>
                                    <span className="t-mono min-w-0 break-all text-r1-ink">{apk.fileName}</span>
                                </div>
                            )}
                            <div>
                                <Button variant="danger" onClick={onAskDeleteApk}>
                                    <Icon icon={Trash2} />
                                    Delete the old APK from storage
                                </Button>
                            </div>
                        </div>
                    </Fold>
                </Folds>
            )}
        </div>
    )
}

/**
 * A store link with its live state beside the label. Built by hand rather
 * than with <Field> because the board puts a status next to the label, and a
 * status inside the <label> would be read out as part of the field's name.
 * Same rules as every field: help below, and an error replaces the help.
 */
function StoreLinkField({
    label,
    placeholder,
    help,
    value,
    error,
    onChange,
}: {
    label: string
    placeholder: string
    help: string
    value: string
    error: string | null
    onChange: (value: string) => void
}) {
    const id = useId()
    const msgId = `${id}-msg`
    const on = value.trim() !== ""
    return (
        <div className="t-field">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label className="t-field-label" htmlFor={id}>
                    {label}
                </label>
                <Status tone={on ? "done" : "off"} word={on ? "Button shows on the site" : "Button hidden"} />
            </div>
            <Input
                id={id}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-describedby={msgId}
                aria-invalid={error ? true : undefined}
            />
            <p className={error ? "t-error" : "t-help"} id={msgId}>
                {error ?? help}
            </p>
        </div>
    )
}
