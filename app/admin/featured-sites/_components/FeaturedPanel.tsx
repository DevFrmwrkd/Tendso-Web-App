"use client"

import { ArrowUpRight, ChevronDown, ChevronUp, Globe, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react"
import { useId } from "react"

import { Button, ButtonLink, Card, cx, EmptyState, Icon, List, MoreMenu, SiteCard } from "@/components/r1"

import { bareUrl, DEFAULT_SITES, screenshotFor, siteMeta, type FeaturedSite } from "./model"

/**
 * The Featured sites tab (board SiteSettings): the curated list in landing
 * order, then a preview of the landing band.
 *
 * A row is one button (it opens the edit drawer) plus its own move and More
 * controls, as the board draws it. On a phone the URL column goes (the
 * drawer shows it) and the screenshot shrinks; the name, place and controls
 * stay on one line.
 */
export function FeaturedPanel({
    sites,
    usingFallback,
    dirty,
    onAdd,
    onEdit,
    onMove,
    onRemove,
    onAskReset,
}: {
    sites: FeaturedSite[]
    /** Nothing is saved: the landing shows the built-in sites. */
    usingFallback: boolean
    dirty: boolean
    onAdd: () => void
    onEdit: (index: number) => void
    onMove: (index: number, dir: -1 | 1) => void
    onRemove: (index: number) => void
    onAskReset: () => void
}) {
    const previewId = useId()
    const n = sites.length

    // The landing shows the curated list in this order, every entry; with
    // none it falls back to the built-in sites, so that is what it previews.
    const cards = n > 0 ? sites : DEFAULT_SITES
    const previewNote =
        n === 0
            ? "No sites on your list, so the landing falls back to the built-in set."
            : dirty
              ? "Your unsaved list, in this order, as visitors will see it under Real sites once you save."
              : usingFallback
                ? "Nothing is saved yet, so the landing shows these built-in sites, in this order, under Real sites."
                : "In this order, as visitors see them under Real sites."

    return (
        <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-4" aria-label="Real sites on the landing">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="t-h2">Real sites on the landing</h2>
                        <p className="t-meta">Shown in this order. Each card on the landing is a live preview of the site’s page.</p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                        <Button onClick={onAdd}>
                            <Icon icon={Plus} />
                            Add a site
                        </Button>
                        {/* On a phone these buttons sit at the left edge, so the
                            menu opens rightwards there instead of off the screen. */}
                        <MoreMenu
                            label="More featured-site actions"
                            className="max-sm:[&>.t-menu]:left-0 max-sm:[&>.t-menu]:right-auto"
                            items={[{ label: "Reset to defaults", icon: <Icon icon={RotateCcw} />, onSelect: onAskReset }]}
                        />
                    </div>
                </div>

                {n > 0 ? (
                    <Card>
                        <List>
                            {sites.map((site, i) => (
                                <SiteRow
                                    key={`${i}-${site.url}`}
                                    site={site}
                                    index={i}
                                    count={n}
                                    onEdit={() => onEdit(i)}
                                    onMove={(dir) => onMove(i, dir)}
                                    onRemove={() => onRemove(i)}
                                />
                            ))}
                        </List>
                    </Card>
                ) : (
                    <Card>
                        <EmptyState
                            title="No featured sites"
                            body={`Until you add some and save, the landing falls back to the ${DEFAULT_SITES.length} built-in sites.`}
                            action={
                                <Button onClick={onAdd}>
                                    <Icon icon={Plus} />
                                    Add a site
                                </Button>
                            }
                        />
                    </Card>
                )}
            </section>

            <section
                className="flex flex-col gap-4 rounded-r1-card border border-r1-line bg-r1-fill-2 p-4 sm:p-6"
                aria-labelledby={previewId}
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="t-h2" id={previewId}>
                            How it looks on the landing
                        </h2>
                        <p className="t-meta">{previewNote}</p>
                    </div>
                    {/* A new tab: following it in this one would drop unsaved changes. */}
                    <ButtonLink size="sm" href="/#sites" target="_blank" rel="noopener noreferrer" className="self-start">
                        Open the landing
                        <Icon icon={ArrowUpRight} />
                    </ButtonLink>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((site, i) => (
                        <li key={`${i}-${site.url}`} className="min-w-0">
                            <SiteCard
                                image={screenshotFor(site.url)}
                                alt={`Landing card preview of ${site.name}`}
                                title={site.name}
                                meta={siteMeta(site)}
                                emptyLabel="Live preview on the landing"
                            />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}

function SiteRow({
    site,
    index,
    count,
    onEdit,
    onMove,
    onRemove,
}: {
    site: FeaturedSite
    index: number
    count: number
    onEdit: () => void
    onMove: (dir: -1 | 1) => void
    onRemove: () => void
}) {
    const first = index === 0
    const last = index === count - 1
    const meta = siteMeta(site)
    return (
        <div className="t-row gap-1 p-2 sm:gap-2 sm:p-3">
            <button
                type="button"
                className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-r1 border-0 bg-transparent px-2 py-1 text-left text-r1-ink hover:bg-r1-fill sm:min-h-16 sm:gap-4"
                aria-label={`Edit ${site.name}`}
                onClick={onEdit}
            >
                <span className="t-meta t-num w-4 flex-none text-right">{index + 1}</span>
                <Thumb url={site.url} />
                {/* Two lines for the name on a phone, where the move buttons leave little room. */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="line-clamp-2 text-[14px] font-medium leading-5 text-r1-ink sm:line-clamp-1">{site.name}</span>
                    {meta && <span className="t-meta line-clamp-1">{meta}</span>}
                </span>
                <span className="t-meta hidden w-[300px] flex-none truncate lg:block">{bareUrl(site.url)}</span>
            </button>
            <div className="flex flex-none items-center gap-0.5">
                <Button variant="ghost" size="sm" icon aria-label={first ? "Already first" : `Move ${site.name} up`} disabled={first} onClick={() => onMove(-1)}>
                    <Icon icon={ChevronUp} />
                </Button>
                <Button variant="ghost" size="sm" icon aria-label={last ? "Already last" : `Move ${site.name} down`} disabled={last} onClick={() => onMove(1)}>
                    <Icon icon={ChevronDown} />
                </Button>
                <MoreMenu
                    label={`More actions for ${site.name}`}
                    size="sm"
                    trigger={(props) => (
                        <Button variant="ghost" size="sm" icon {...props}>
                            <Icon icon={MoreHorizontal} />
                        </Button>
                    )}
                    items={[
                        { label: "Edit details", icon: <Icon icon={Pencil} />, onSelect: onEdit },
                        // The old editor's "Open ↗" beside each URL.
                        { label: "Open the live site", icon: <Icon icon={ArrowUpRight} />, href: site.url, external: true },
                        "divider",
                        { label: "Remove from landing", icon: <Icon icon={Trash2} />, danger: true, onSelect: onRemove },
                    ]}
                />
            </div>
        </div>
    )
}

/** The site's screenshot when it has one (the built-in sites do), or an empty frame with a globe. */
function Thumb({ url }: { url: string }) {
    const src = screenshotFor(url)
    const box = "h-9 w-14 flex-none rounded-r1-sm border border-r1-line bg-r1-fill-2 sm:h-[60px] sm:w-[104px]"
    if (src) {
        // A local screenshot from /public/Pages; the row's label already names the site.
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={cx(box, "block object-cover object-top")} src={src} alt="" />
    }
    return (
        <span className={cx(box, "flex items-center justify-center text-r1-ink-4")} aria-hidden="true">
            <Icon icon={Globe} size={20} />
        </span>
    )
}
