"use client";

import { useQueries } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Icon, PageHeader, SearchInput, Tabs } from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "@/hooks/useCallSchedule";

import { AddLeadDrawer } from "./AddLeadDrawer";
import { CustomerLeadsView } from "./CustomerLeadsView";
import { LeadsBoundary } from "./LeadsBoundary";
import ProspectsView from "./ProspectsView";
import { asList, asProspects, PAGE_SUB, PAGE_TITLE, type LeadRow, type SubmissionRow } from "./leadUtils";

/**
 * The three lists behind the page, read through useQueries: a failing query
 * comes back as an Error value for its own tab to show, instead of being
 * thrown into the render like useQuery does. Built once, at module load,
 * because `api.x.y` is a fresh reference on every read and useQueries
 * re-subscribes whenever the object it is handed changes.
 *
 *  - leads.getAll: the newest 500 leads of every source (customer tab).
 *  - outscraper.listScrapedLeads: Google Maps prospects not interviewed yet
 *    (Prospects tab). `{}` as before: it takes only `{ limit? }`.
 *  - submissions.getAll: the "Link to a submission" picker, and the city
 *    under a linked site's name.
 */
const LISTS = {
    leads: { query: api.leads.getAll, args: {} },
    prospects: { query: api.outscraper.listScrapedLeads, args: {} },
    submissions: { query: api.submissions.getAll, args: {} },
};

/** getAll's .take(500): a full page means there may be older leads it did not return. */
const LEADS_CAP = 500;

type Tab = "customers" | "prospects";

/**
 * /admin/leads once the admin is known (board AdminLeads). Owns what both
 * tabs share: the search box in the header (one per tab), the one primary
 * action (Add lead, on the customer tab), which drawer is open, and the
 * add flow. Each tab owns its own filters, sort and page; both stay mounted
 * so switching tabs and back keeps them.
 */
export function LeadsWorkspace({ meId }: { meId: Id<"creators"> | null }) {
    const now = useNow();
    const results = useQueries(LISTS);
    const leads = asList<LeadRow>(results.leads);
    const prospects = asProspects(results.prospects);
    const submissions = asList<SubmissionRow>(results.submissions);

    const [tab, setTab] = useState<Tab>("customers");
    const [searchLeads, setSearchLeads] = useState("");
    const [searchProspects, setSearchProspects] = useState("");
    const [openLeadId, setOpenLeadId] = useState<string | null>(null);
    const [openProspectId, setOpenProspectId] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    // Bumped after an add: the customer list remounts with its filters
    // cleared and sorted newest first, so the new lead is the top row.
    const [added, setAdded] = useState(0);

    // Every lead shows in exactly one tab. getAll returns all sources; the
    // Google Maps prospects nobody has interviewed (what listScrapedLeads
    // lists) belong to Prospects. A converted one has a submission and stays
    // here, as it did on the old page.
    const customerRows = leads.data?.filter((l) => !(l.source === "outscraper" && !l.submissionId));

    const cityBySubmission = new Map<string, string>();
    for (const s of submissions.data ?? []) if (s.city) cityBySubmission.set(s._id, s.city);
    const cityOf = (lead: LeadRow): string | null =>
        (lead.submissionId ? cityBySubmission.get(lead.submissionId) : undefined) ?? lead.businessCity ?? null;

    const isCustomers = tab === "customers";

    const switchTab = (next: Tab) => {
        // Switching tabs closes any open drawer, as the board does.
        setTab(next);
        setOpenLeadId(null);
        setOpenProspectId(null);
    };

    return (
        <>
            <PageHeader
                // On a phone the header stacks; stretch it so the search box takes the row.
                className="max-sm:items-stretch"
                title={PAGE_TITLE}
                sub={PAGE_SUB}
                actions={
                    <>
                        <SearchInput
                            className="min-w-0 flex-1 sm:w-[280px] sm:flex-none"
                            label={isCustomers ? "Search leads" : "Search prospects"}
                            placeholder={isCustomers ? "Search leads" : "Search prospects"}
                            value={isCustomers ? searchLeads : searchProspects}
                            onChange={(e) => (isCustomers ? setSearchLeads(e.target.value) : setSearchProspects(e.target.value))}
                        />
                        {isCustomers && (
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setOpenLeadId(null);
                                    setAddOpen(true);
                                }}
                            >
                                <Icon icon={Plus} />
                                Add lead
                            </Button>
                        )}
                    </>
                }
            />

            <Tabs
                label="Lead type"
                value={tab}
                onChange={switchTab}
                tabs={[
                    { value: "customers", label: "Customer leads", count: customerRows?.length ?? null },
                    { value: "prospects", label: "Prospects", count: prospects.data?.length ?? null },
                ]}
            >
                <div hidden={!isCustomers}>
                    <LeadsBoundary what="Customer leads">
                        <CustomerLeadsView
                            key={added}
                            rows={customerRows}
                            error={leads.error}
                            capped={(leads.data?.length ?? 0) >= LEADS_CAP}
                            cityOf={cityOf}
                            search={searchLeads}
                            now={now}
                            meId={meId}
                            openId={openLeadId}
                            initialSort={added > 0 ? "newest" : "waiting"}
                            onOpen={setOpenLeadId}
                            onClose={() => setOpenLeadId(null)}
                            onDeleted={(name) => {
                                setOpenLeadId(null);
                                toast.success(`${name} deleted`);
                            }}
                            onClearSearch={() => setSearchLeads("")}
                        />
                    </LeadsBoundary>
                </div>
                <div hidden={isCustomers}>
                    <LeadsBoundary what="Prospects">
                        <ProspectsView
                            rows={prospects.data}
                            error={prospects.error}
                            search={searchProspects}
                            now={now}
                            openId={openProspectId}
                            onOpen={setOpenProspectId}
                            onClose={() => setOpenProspectId(null)}
                            onClearSearch={() => setSearchProspects("")}
                        />
                    </LeadsBoundary>
                </div>
            </Tabs>

            <AddLeadDrawer
                open={addOpen}
                onClose={() => setAddOpen(false)}
                submissions={submissions}
                onAdded={(name) => {
                    setAddOpen(false);
                    setTab("customers");
                    setSearchLeads("");
                    setAdded((n) => n + 1);
                    toast.success(`Lead added for ${name}`);
                }}
            />
        </>
    );
}
