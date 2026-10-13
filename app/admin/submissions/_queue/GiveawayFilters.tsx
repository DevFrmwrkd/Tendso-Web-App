"use client"

import { GIVEAWAY_FILTERS, type GiveawayFilter } from "./model"

/** Selecting a stage opens it across all website workflow tabs. */
export function GiveawayFilters({ value, counts, onChange }: {
    value: GiveawayFilter | null
    counts: Record<GiveawayFilter, number>
    onChange: (value: GiveawayFilter | null) => void
}) {
    return (
        <section aria-label="Giveaway approval filters" className="mb-4 flex flex-col gap-2">
            <h2 className="t-label">Giveaway approval</h2>
            <div className="flex flex-wrap gap-2">
                {GIVEAWAY_FILTERS.map((filter) => (
                    <button
                        key={filter.key}
                        type="button"
                        className="t-chip min-h-11"
                        aria-pressed={value === filter.key}
                        onClick={() => onChange(value === filter.key ? null : filter.key)}
                    >
                        {filter.label}
                        <span className="t-num ml-1.5">{counts[filter.key]}</span>
                    </button>
                ))}
            </div>
            <p className="t-help">Start with approved giveaways marked Ready to build. Awaiting review and rejected applications are not ready for website work.</p>
        </section>
    )
}
