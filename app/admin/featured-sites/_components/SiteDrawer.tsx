"use client"

import { useQuery } from "convex/react"
import { useId, useMemo, useState, type ChangeEvent } from "react"

import { Button, Drawer, Field, Input, Select } from "@/components/r1"
import { api } from "@/convex/_generated/api"

import { screenshotFor, siteErrors, trimSite, type FeaturedSite } from "./model"

export type Editor = { mode: "add" } | { mode: "edit"; index: number }

const BLANK: FeaturedSite = { name: "", category: "", city: "", url: "" }

/**
 * Add or edit one featured site (board SiteSettings, the 480 drawer).
 *
 * Nothing here touches the landing: "Add to list" and "Update site" change the
 * unsaved list on the page, and the page's Save writes it. That is also why
 * "Remove from landing" needs no confirmation: Discard brings the site back.
 *
 * The parent remounts this (a new `key`) each time it opens, so the form
 * always starts from the site being edited, or blank for a new one.
 */
export function SiteDrawer({
    editor,
    sites,
    onApply,
    onRemove,
    onClose,
}: {
    editor: Editor | null
    sites: FeaturedSite[]
    onApply: (site: FeaturedSite) => void
    onRemove: () => void
    onClose: () => void
}) {
    const formId = useId()
    const isAdd = editor?.mode === "add"
    const index = editor?.mode === "edit" ? editor.index : -1
    const editing = index >= 0 ? sites[index] : undefined

    const [form, setForm] = useState<FeaturedSite>(() => (editing ? { ...editing } : BLANK))
    const [tried, setTried] = useState(false)
    const [picked, setPicked] = useState("")

    // Only an add offers the picker, so only an add pays for the list. These
    // are the sites Tendso published (generatedWebsites, status "published");
    // a site built elsewhere is typed in by hand instead.
    const published = useQuery(api.generatedWebsites.listPublished, isAdd ? {} : "skip")
    const options = useMemo(
        () =>
            (published ?? [])
                .map((p) => ({
                    id: String(p.id),
                    name: p.businessName ?? "",
                    city: p.city ?? "",
                    category: p.businessType ?? "",
                    url: p.publishedUrl ?? "",
                }))
                .filter((p) => p.name && p.url)
                .sort((a, b) => a.name.localeCompare(b.name)),
        [published],
    )

    const errors = tried ? siteErrors(form) : {}
    const set = (key: keyof FeaturedSite) => (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setForm((f) => ({ ...f, [key]: value }))
    }

    const pick = (e: ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value
        setPicked(id)
        const p = options.find((o) => o.id === id)
        if (!p) return
        setForm({ name: p.name, category: p.category, city: p.city, url: p.url })
        setTried(false)
    }

    const apply = () => {
        const e = siteErrors(form)
        if (e.url || e.name) {
            setTried(true)
            return
        }
        onApply(trimSite(form))
    }

    const shot = editing ? screenshotFor(editing.url) : null

    return (
        <Drawer
            open={editor !== null}
            onClose={onClose}
            title={isAdd ? "Add a site" : "Edit site"}
            meta={isAdd ? "It goes to the end of the list. Move it up after." : `Site ${index + 1} of ${sites.length} on the landing`}
            footer={
                <>
                    {!isAdd && (
                        <Button variant="danger" className="mr-auto" onClick={onRemove}>
                            Remove from landing
                        </Button>
                    )}
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form={formId}>
                        {isAdd ? "Add to list" : "Update site"}
                    </Button>
                </>
            }
        >
            {shot && editing && (
                // A screenshot from /public/Pages, the same picture the old carousel used.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    className="block h-[180px] w-full flex-none rounded-r1 border border-r1-line bg-r1-fill-2 object-cover object-top"
                    src={shot}
                    alt={`Screenshot of the ${editing.name} website`}
                />
            )}

            <form
                id={formId}
                noValidate
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                    e.preventDefault()
                    apply()
                }}
            >
                {isAdd && (
                    <>
                        <Field label="Pick a published Tendso site" help="Fills in the fields below. Or type them yourself for a site built elsewhere.">
                            <Select value={picked} onChange={pick} disabled={published === undefined || options.length === 0}>
                                {published === undefined ? (
                                    <option value="">Loading published sites…</option>
                                ) : options.length === 0 ? (
                                    <option value="">No published sites yet</option>
                                ) : (
                                    <>
                                        <option value="">Choose a site</option>
                                        {options.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.city ? `${o.name} · ${o.city}` : o.name}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </Select>
                        </Field>
                        <hr className="t-divider" />
                    </>
                )}

                <Field
                    label="Live URL"
                    required
                    help="The full address, starting with https://. The landing card shows a live preview of this page."
                    error={errors.url}
                >
                    <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://example.com/" value={form.url} onChange={set("url")} />
                </Field>

                <Field label="Business name" required error={errors.name}>
                    <Input type="text" autoComplete="off" placeholder="Ben Joe Tire Supply" value={form.name} onChange={set("name")} />
                </Field>

                <Field label="Category" help="Shown under the name on the card.">
                    <Input type="text" autoComplete="off" placeholder="Auto · Tire Supply" value={form.category} onChange={set("category")} />
                </Field>

                <Field label="City">
                    <Input type="text" autoComplete="off" placeholder="Makati" value={form.city} onChange={set("city")} />
                </Field>
            </form>
        </Drawer>
    )
}
