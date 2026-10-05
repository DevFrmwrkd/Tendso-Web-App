"use client"

import { useAction, useMutation, useQuery } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button, ConfirmDialog, Dot, Loading, Skeleton, Tabs } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { AppLinksPanel, type StoreKey, type StoreLinks } from "./AppLinksPanel"
import { FeaturedPanel } from "./FeaturedPanel"
import {
    DEFAULT_SITES,
    FEATURED_DESCRIPTION,
    FEATURED_KEY,
    joinNames,
    readSaved,
    sameSite,
    sameSites,
    storeLinkError,
    trimSite,
    type FeaturedSite,
} from "./model"
import { SiteDrawer, type Editor } from "./SiteDrawer"

type Tab = "featured" | "app"

/** `?tab=app` is the App links tab (where /admin/app-release now lands); anything else is Featured sites. */
const parseTab = (value: string | null): Tab => (value === "app" ? "app" : "featured")

const asText = (value: unknown): string => (typeof value === "string" ? value : "")

/**
 * Site settings (board SiteSettings): "What does the public site show?"
 *
 * Two tabs over the Convex settings the public pages read:
 *  - Featured sites: `featured_sites`, the curated list behind the landing's
 *    Real sites band (it falls back to the built-in sites when unset).
 *  - App links: `play_store_url` and `app_store_url`, plus the clean-up of
 *    the APK the old App release page hosted (`apk_*`).
 *
 * EVERY CHANGE IS A DRAFT until Save. Both tabs feed one unsaved-changes bar
 * with one Save, as the board draws it: nothing reaches the public site until
 * then, and Discard puts both back. The draft is kept as "what differs from
 * what is saved" (null when nothing does), so the page needs no effect to
 * copy the saved values in, and an edit that undoes itself clears the bar.
 *
 * The tab is in the URL (`?tab=app`) so the old /admin/app-release route can
 * redirect straight to it. It is written with router.replace: a tab is not a
 * page, and Back should leave Site settings.
 */
export function SiteSettings({ isAdmin, adminId }: { isAdmin: boolean; adminId: string | undefined }) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Every query waits for the role: nothing is read for a non-admin.
    const skip = !isAdmin
    const savedFeatured = useQuery(api.settings.get, skip ? "skip" : { key: FEATURED_KEY }) as unknown
    // Store-link settings: what /for-creators, /otr and /api/download-apk read.
    const savedIos = useQuery(api.settings.get, skip ? "skip" : { key: "app_store_url" }) as unknown
    const savedPlay = useQuery(api.settings.get, skip ? "skip" : { key: "play_store_url" }) as unknown
    // The legacy APK, still in R2 from before the store listings existed.
    // Nothing serves it any more, so this is purely about not paying to store
    // a file nobody can reach.
    const legacyApkUrl = useQuery(api.settings.get, skip ? "skip" : { key: "apk_download_url" }) as unknown
    const legacyApkFileName = useQuery(api.settings.get, skip ? "skip" : { key: "apk_file_name" }) as unknown
    const legacyApkKey = useQuery(api.settings.get, skip ? "skip" : { key: "apk_r2_key" }) as unknown

    const setSetting = useMutation(api.settings.set)
    const deleteR2File = useAction(api.r2.deleteFile)

    // The tab follows the URL when it moves on its own (Back, a link); our
    // own router.replace lands here too, by which time the state matches.
    const urlTab = parseTab(searchParams.get("tab"))
    const [tab, setTab] = useState<Tab>(urlTab)
    const [seenTab, setSeenTab] = useState<Tab>(urlTab)
    if (seenTab !== urlTab) {
        setSeenTab(urlTab)
        setTab(urlTab)
    }

    const [draft, setDraft] = useState<FeaturedSite[] | null>(null)
    const [ops, setOps] = useState(0)
    const [linkDraft, setLinkDraft] = useState<StoreLinks | null>(null)
    const [linksTried, setLinksTried] = useState(false)
    const [editor, setEditor] = useState<Editor | null>(null)
    const [editorSeq, setEditorSeq] = useState(0)
    const [confirm, setConfirm] = useState<"reset" | "apk" | null>(null)
    const [saving, setSaving] = useState(false)
    const [cleaning, setCleaning] = useState(false)

    const loading =
        savedFeatured === undefined ||
        savedIos === undefined ||
        savedPlay === undefined ||
        legacyApkUrl === undefined ||
        legacyApkFileName === undefined ||
        legacyApkKey === undefined

    // ── Featured sites ──────────────────────────────────────────────────
    // The editor starts from what the landing already shows: the saved list,
    // or the built-in sites when nothing is saved, so nothing changes until
    // an admin saves.
    const savedList = readSaved(savedFeatured)
    const base = savedList ?? DEFAULT_SITES
    const sites = draft ?? base
    const featuredDirty = draft !== null && !sameSites(draft, base)

    const editSites = (next: FeaturedSite[]) => {
        if (sameSites(next, base)) {
            setDraft(null)
            setOps(0)
        } else {
            setDraft(next)
            setOps((n) => n + 1)
        }
    }
    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir
        if (j < 0 || j >= sites.length) return
        const next = sites.slice()
        const tmp = next[i]
        next[i] = next[j]
        next[j] = tmp
        editSites(next)
    }
    const remove = (i: number) => editSites(sites.filter((_, k) => k !== i))
    const openEditor = (next: Editor) => {
        setEditor(next)
        setEditorSeq((n) => n + 1)
    }
    const applySite = (site: FeaturedSite) => {
        if (!editor) return
        if (editor.mode === "edit") {
            const current = sites[editor.index]
            if (!current || !sameSite(current, site)) editSites(sites.map((s, k) => (k === editor.index ? site : s)))
        } else {
            editSites([...sites, site])
        }
        setEditor(null)
    }
    const removeFromDrawer = () => {
        if (editor?.mode === "edit") remove(editor.index)
        setEditor(null)
    }
    const resetToDefaults = () => {
        editSites(DEFAULT_SITES.map((s) => ({ ...s })))
        setConfirm(null)
    }

    // ── Store links ─────────────────────────────────────────────────────
    const savedLinks: StoreLinks = { play: asText(savedPlay), ios: asText(savedIos) }
    const links = linkDraft ?? savedLinks
    const linkChanges = (["play", "ios"] as const).filter((k) => links[k].trim() !== savedLinks[k].trim()).length
    const linkErrors: Record<StoreKey, string | null> = {
        play: linksTried ? storeLinkError(links.play) : null,
        ios: linksTried ? storeLinkError(links.ios) : null,
    }
    const changeLink = (key: StoreKey, value: string) => setLinkDraft({ ...links, [key]: value })

    const legacyApk = asText(legacyApkUrl) ? { fileName: asText(legacyApkFileName) || null } : null

    // ── Tabs ────────────────────────────────────────────────────────────
    const changeTab = (next: Tab) => {
        setTab(next)
        const sp = new URLSearchParams(searchParams.toString())
        if (next === "app") sp.set("tab", "app")
        else sp.delete("tab")
        const q = sp.toString()
        router.replace(q ? `/admin/featured-sites?${q}` : "/admin/featured-sites", { scroll: false })
    }

    // ── Save / Discard ──────────────────────────────────────────────────
    // One change per edit on the list (as the board counts them), plus one per
    // store link that differs from what is saved.
    const changes = (featuredDirty ? Math.max(ops, 1) : 0) + linkChanges

    const save = async () => {
        if (storeLinkError(links.play) || storeLinkError(links.ios)) {
            setLinksTried(true)
            if (tab !== "app") changeTab("app")
            toast.error("Fix the store link, then save.")
            return
        }
        setSaving(true)
        try {
            if (featuredDirty) {
                // The same clean-up the editor always did before writing:
                // trimmed, and a row without a name or a URL is dropped.
                const cleaned = sites.map(trimSite).filter((s) => s.name && s.url)
                const badUrl = cleaned.find((s) => !/^https?:\/\//i.test(s.url))
                if (badUrl) {
                    toast.error(`"${badUrl.name || "A site"}" needs a full URL starting with https://`)
                    return
                }
                await setSetting({ key: FEATURED_KEY, value: cleaned, description: FEATURED_DESCRIPTION, adminId })
                setDraft(null)
                setOps(0)
            }
            if (linkChanges > 0) {
                await setSetting({ key: "app_store_url", value: links.ios.trim() || null, description: "App Store listing URL", adminId })
                await setSetting({ key: "play_store_url", value: links.play.trim() || null, description: "Google Play listing URL", adminId })
                setLinkDraft(null)
                setLinksTried(false)
            }
            toast.success("Saved. The public site shows your changes now.")
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const discard = () => {
        setDraft(null)
        setOps(0)
        setLinkDraft(null)
        setLinksTried(false)
        toast("Changes discarded.")
    }

    // ── Old APK clean-up (unchanged from the App release page) ───────────
    const cleanupLegacyApk = async () => {
        setCleaning(true)
        try {
            const key = asText(legacyApkKey)
            if (key) {
                await deleteR2File({ key })
            }
            // Clear the settings even if there was no key left to delete —
            // otherwise this panel would never go away.
            await setSetting({ key: "apk_download_url", value: null, adminId })
            await setSetting({ key: "apk_file_name", value: null, adminId })
            await setSetting({ key: "apk_uploaded_at", value: null, adminId })
            await setSetting({ key: "apk_r2_key", value: null, adminId })
            toast.success("Old APK deleted from storage.")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to remove the old APK.")
        } finally {
            setCleaning(false)
            setConfirm(null)
        }
    }

    if (loading) return <SettingsSkeleton />

    return (
        <>
            <div className="flex w-full max-w-[960px] flex-col">
                <Tabs
                    label="Site settings sections"
                    className="gap-6"
                    tabs={[
                        { value: "featured", label: "Featured sites", count: sites.length },
                        { value: "app", label: "App links" },
                    ]}
                    value={tab}
                    onChange={changeTab}
                >
                    {tab === "featured" ? (
                        <FeaturedPanel
                            sites={sites}
                            usingFallback={savedList === null}
                            dirty={featuredDirty}
                            onAdd={() => openEditor({ mode: "add" })}
                            onEdit={(index) => openEditor({ mode: "edit", index })}
                            onMove={move}
                            onRemove={remove}
                            onAskReset={() => setConfirm("reset")}
                        />
                    ) : (
                        <AppLinksPanel
                            links={links}
                            errors={linkErrors}
                            onChange={changeLink}
                            apk={legacyApk}
                            onAskDeleteApk={() => setConfirm("apk")}
                        />
                    )}
                </Tabs>
            </div>

            {changes > 0 && (
                <>
                    {/* Room under the content, so the bar never covers the last row. */}
                    <div aria-hidden="true" className="h-24 flex-none sm:h-12" />
                    <div
                        role="region"
                        aria-label="Unsaved changes"
                        className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 border-t border-r1-line bg-r1-paper px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:left-[240px] lg:h-[72px] lg:px-12 lg:py-0"
                    >
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-r1-ink">
                            <Dot tone="attn" />
                            <strong className="font-medium">{changes === 1 ? "1 change" : `${changes} changes`}</strong>
                            <span className="t-meta">Not on the public site until you save.</span>
                        </span>
                        <span className="flex flex-none gap-2">
                            <Button onClick={discard} disabled={saving}>
                                Discard
                            </Button>
                            <Button variant="primary" onClick={save} disabled={saving} aria-busy={saving}>
                                {saving ? "Saving…" : "Save"}
                            </Button>
                        </span>
                    </div>
                </>
            )}

            <SiteDrawer
                key={editorSeq}
                editor={editor}
                sites={sites}
                onApply={applySite}
                onRemove={removeFromDrawer}
                onClose={() => setEditor(null)}
            />

            <ConfirmDialog
                open={confirm === "reset"}
                onCancel={() => setConfirm(null)}
                onConfirm={resetToDefaults}
                title="Reset to the default sites?"
                confirmLabel="Reset list"
                cancelLabel="Cancel"
                destructive={false}
            >
                <p>
                    Your list is replaced by the {DEFAULT_SITES.length} built-in sites: {joinNames(DEFAULT_SITES.map((s) => s.name))}. The landing does not
                    change until you save, and Discard brings your list back.
                </p>
            </ConfirmDialog>

            <ConfirmDialog
                open={confirm === "apk"}
                onCancel={() => setConfirm(null)}
                onConfirm={cleanupLegacyApk}
                title="Delete the old APK from storage?"
                confirmLabel="Delete the APK"
                cancelLabel="Cancel"
                busy={cleaning}
            >
                <p>
                    This removes {legacyApk?.fileName ?? "the old APK file"} from storage and clears its settings. Nothing on the site links to it, so
                    visitors will not notice. This cannot be undone.
                </p>
            </ConfirmDialog>
        </>
    )
}

/** The tabs, the section head and four site rows: the page's shape while the settings load. */
export function SettingsSkeleton() {
    return (
        <Loading label="Loading site settings" className="flex w-full max-w-[960px] flex-col gap-6">
            <div className="flex h-10 items-center gap-6 border-b border-r1-line">
                <Skeleton width={112} height={14} />
                <Skeleton width={72} height={14} />
            </div>
            <div className="flex flex-col gap-2">
                <Skeleton width={200} height={16} />
                <Skeleton width="60%" height={12} />
            </div>
            <div className="t-card overflow-hidden" aria-hidden="true">
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="t-row gap-3 p-3 sm:gap-4">
                        <Skeleton width={16} height={12} />
                        <span className="t-sk h-9 w-14 flex-none sm:h-[60px] sm:w-[104px]" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <Skeleton width="50%" height={12} />
                            <Skeleton width="35%" height={10} />
                        </span>
                    </div>
                ))}
            </div>
        </Loading>
    )
}
