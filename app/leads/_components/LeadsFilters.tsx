"use client";

import { Funnel } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Button, Chips, Fold, Folds, Icon, Input, SearchInput, Select, cx, leadStatus, type ChipItem } from "@/components/r1";

import {
    DISTANCE_OPTIONS,
    LEAD_STATUSES,
    RATING_OPTIONS,
    SORT_LABELS,
    type LeadsTab,
    type ProspectFilterValues,
    type SortKey,
    type StatusFilter,
} from "./leadUtils";
import type { MyLocation } from "./useMyLocation";

/** Everything the Filters fold sets, besides the search box. */
export type Filters = ProspectFilterValues & {
    /** "auto": closest first once the creator's position is known, newest first until then. */
    sort: SortKey | "auto";
    /** Interviewed tab: these two go to api.leads.listForMobileCRM as before. */
    status: StatusFilter;
    onlyMine: boolean;
};

export const NO_FILTERS: Filters = {
    category: "all",
    rating: "any",
    distance: "any",
    city: "",
    sort: "auto",
    status: "all",
    onlyMine: false,
};

const STATUS_CHIPS: ChipItem<StatusFilter>[] = [
    { value: "all", label: "All" },
    ...LEAD_STATUSES.map((s) => ({ value: s, label: leadStatus(s).word })),
];

/**
 * The Filters fold (board: Leads), closed by default. The fold's own line says
 * which filters are on, so a closed fold still tells the truth about the list.
 *
 * The board shows category, rating and distance. The old feed also had a
 * search box, a city filter and a sort (prospects), and status and "only mine"
 * (interviewed leads); they live here too rather than being lost.
 */
export function LeadsFilters({
    tab,
    search,
    onSearch,
    filters,
    onChange,
    categories,
    sort,
    location,
    onAskLocation,
    summary,
    hasFilters,
    onClear,
}: {
    tab: LeadsTab;
    search: string;
    onSearch: (value: string) => void;
    filters: Filters;
    onChange: (patch: Partial<Filters>) => void;
    categories: ChipItem<string>[];
    /** The sort in effect ("auto" resolved). */
    sort: SortKey;
    location: MyLocation;
    onAskLocation: () => void;
    summary: string;
    hasFilters: boolean;
    onClear: () => void;
}) {
    const ids = useId();
    const interviewed = tab === "interviewed";
    const sortOptions = (Object.keys(SORT_LABELS) as SortKey[]).filter((k) => k !== "closest" || location.status === "ready");

    return (
        <Folds>
            <Fold
                title={
                    <span className="flex min-w-0 items-center gap-2.5">
                        <Icon icon={Funnel} />
                        Filters
                        <span className="t-meta truncate font-normal">{summary}</span>
                    </span>
                }
            >
                <div className="flex flex-col gap-3 pt-1">
                    {/* SearchInput names itself (a screen-reader label); the row's caption is visual. */}
                    <FilterRow label="Search" input>
                        <SearchInput
                            id={`${ids}-q`}
                            label={interviewed ? "Search leads" : "Search shops"}
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder={interviewed ? "Lead, business or creator…" : "Name, address, city or phone…"}
                            className="max-w-md"
                        />
                    </FilterRow>

                    {interviewed ? (
                        <>
                            <FilterRow label="Status">
                                <Chips label="Status" options={STATUS_CHIPS} value={filters.status} onChange={(status) => onChange({ status })} />
                            </FilterRow>
                            <FilterRow label="Whose">
                                <Chips
                                    label="Whose leads"
                                    options={[
                                        { value: "everyone", label: "Everyone's" },
                                        { value: "mine", label: "Only mine" },
                                    ]}
                                    value={filters.onlyMine ? "mine" : "everyone"}
                                    onChange={(v) => onChange({ onlyMine: v === "mine" })}
                                />
                            </FilterRow>
                        </>
                    ) : (
                        <>
                            {categories.length > 0 && (
                                <FilterRow label="Category">
                                    <Chips label="Category" options={categories} value={filters.category} onChange={(category) => onChange({ category })} />
                                </FilterRow>
                            )}
                            <FilterRow label="Rating">
                                <Chips label="Rating" options={RATING_OPTIONS} value={filters.rating} onChange={(rating) => onChange({ rating })} />
                            </FilterRow>
                            <FilterRow label="Distance">
                                {location.status === "ready" ? (
                                    <Chips label="Distance" options={DISTANCE_OPTIONS} value={filters.distance} onChange={(distance) => onChange({ distance })} />
                                ) : location.status === "denied" || location.status === "unsupported" ? (
                                    <p className="t-meta sm:pt-2">Distance needs your location, and this browser is not sharing it.</p>
                                ) : (
                                    <p className="t-meta sm:pt-2">
                                        Distance needs your location.{" "}
                                        <button type="button" className="t-link" onClick={onAskLocation} disabled={location.status === "asking"}>
                                            {location.status === "asking" ? "Finding you…" : "Use my location"}
                                        </button>
                                    </p>
                                )}
                            </FilterRow>
                            <FilterRow label="City" htmlFor={`${ids}-city`} input>
                                <Input
                                    id={`${ids}-city`}
                                    value={filters.city}
                                    onChange={(e) => onChange({ city: e.target.value })}
                                    placeholder="Any city"
                                    className="max-w-60"
                                />
                            </FilterRow>
                            <FilterRow label="Sort" htmlFor={`${ids}-sort`} input>
                                <div className="max-w-60">
                                    <Select id={`${ids}-sort`} value={sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
                                        {sortOptions.map((k) => (
                                            <option key={k} value={k}>
                                                {SORT_LABELS[k]}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            </FilterRow>
                        </>
                    )}

                    {hasFilters && (
                        <div className="sm:pl-24">
                            <Button variant="ghost" size="sm" onClick={onClear}>
                                Clear filters
                            </Button>
                        </div>
                    )}
                </div>
            </Fold>
        </Folds>
    );
}

/**
 * Label on the left at desk width, above on a phone (board: ld-filter-row).
 * `input` lines the label up with a 40px field instead of a 32px chip.
 */
function FilterRow({ label, htmlFor, input = false, children }: { label: string; htmlFor?: string; input?: boolean; children: ReactNode }) {
    const cls = cx("t-label sm:w-20 sm:flex-none", input ? "sm:pt-3" : "sm:pt-2");
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            {htmlFor ? (
                <label className={cls} htmlFor={htmlFor}>
                    {label}
                </label>
            ) : (
                // The control names itself (a chip group, the search box); this is its visible caption.
                <span className={cls} aria-hidden="true">
                    {label}
                </span>
            )}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}
