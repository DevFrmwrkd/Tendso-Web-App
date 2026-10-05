import type { ReactNode } from "react";

import { Fold, Folds, LinkSegmented, PublicFooter, PublicHeader, PublicPage, buttonClass } from "@/components/r1";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";

import { CopyEmailButton } from "./CopyEmailButton";
import { LegalToc } from "./LegalToc";

/*
 * The frame both legal documents wear (Round 1, board Legal): the site header,
 * the title with the document switch beside it, then the numbered sections
 * with "On this page" in a rail on the left.
 *
 * THE SWITCH IS TWO LINKS, not a toggle. Each document keeps its own URL, its
 * own title and description, and the links people already have to it; the
 * board's segmented control is only its look.
 *
 * ONLY THE PRESENTATION LIVES HERE. The words of each document are in its own
 * page.tsx and are legal copy: they are passed in exactly as written.
 *
 * On a phone there is no rail. The contents fold up above the first section
 * (closed, the kit's rule for anything you open on purpose), and the address
 * is in the last section, as a link.
 */

export type LegalSection = { id: string; title: string; body: ReactNode };

const DOCS = [
    { key: "privacy", href: "/privacy-policy", label: "Privacy policy" },
    { key: "terms", href: "/terms-of-service", label: "Terms of service" },
] as const;

function Sep() {
    return <span className="size-[3px] flex-none rounded-full bg-r1-ink-4" aria-hidden="true" />;
}

export function LegalDoc({
    doc,
    title,
    intro,
    updated,
    sections,
    ask,
}: {
    doc: (typeof DOCS)[number]["key"];
    title: string;
    /** The document's own opening line. */
    intro: string;
    /** When the document last changed, as written on it. Left out when nobody has said; never a placeholder. */
    updated?: string;
    sections: LegalSection[];
    /** The question over the address in the rail. */
    ask: string;
}) {
    const toc = sections.map((s) => ({ id: s.id, title: s.title }));
    return (
        <PublicPage
            header={<PublicHeader />}
            footer={
                <PublicFooter
                    links={[
                        { href: "/", label: "Home" },
                        { href: "/knowledge", label: "Help" },
                    ]}
                    contact
                />
            }
        >
            <div className="mx-auto flex w-full max-w-[1032px] flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:gap-10 lg:pt-12">
                <header id="top" className="t-page-head scroll-mt-24">
                    <div className="t-page-titles">
                        <h1 className="t-h1">{title}</h1>
                        <p className="t-sub">What are the rules?</p>
                        <p className="t-meta flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1.5">
                            {updated && (
                                <>
                                    <span>
                                        Last updated <strong className="font-medium text-r1-ink">{updated}</strong>
                                    </span>
                                    <Sep />
                                </>
                            )}
                            <span>
                                Operated by <strong className="font-medium text-r1-ink">{OPERATOR}</strong>
                            </span>
                            <Sep />
                            <span>{sections.length} sections</span>
                        </p>
                    </div>
                    <LinkSegmented
                        label="Document"
                        className="flex-none"
                        current={DOCS.find((d) => d.key === doc)?.href ?? ""}
                        options={DOCS.map((d) => ({ href: d.href, label: d.label }))}
                    />
                </header>

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
                    <aside className="flex flex-col gap-5 max-lg:hidden lg:sticky lg:top-24 lg:w-60 lg:flex-none">
                        <nav aria-label="Contents" className="flex flex-col gap-5">
                            <span className="t-label px-2.5">On this page</span>
                            <LegalToc items={toc} />
                        </nav>
                        <div className="flex flex-col gap-2.5 border-t border-r1-line pt-5">
                            <p className="t-meta">{ask}</p>
                            <p className="text-sm font-medium leading-5 text-r1-ink">{SUPPORT_EMAIL}</p>
                            <CopyEmailButton email={SUPPORT_EMAIL} />
                        </div>
                    </aside>

                    <article className="flex min-w-0 max-w-[680px] flex-col gap-7">
                        <p className="text-[15px] leading-6 text-r1-ink">{intro}</p>

                        <Folds className="lg:hidden">
                            <Fold title="On this page">
                                <nav aria-label="Contents">
                                    <LegalToc items={toc} />
                                </nav>
                            </Fold>
                        </Folds>

                        {sections.map((s, i) => (
                            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-24 flex-col gap-2">
                                <h2 id={`${s.id}-h`} className="t-h2 flex items-baseline gap-3">
                                    <span className="w-5 flex-none text-sm font-medium text-r1-ink-3 tabular-nums">{i + 1}</span>
                                    <span>{s.title}</span>
                                </h2>
                                <div className="flex flex-col gap-3 pl-8 text-[15px] leading-6 text-r1-ink-2">{s.body}</div>
                            </section>
                        ))}

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-r1-line pl-8 pt-5">
                            <span className="t-meta">Tendso is operated by {OPERATOR}, Philippines.</span>
                            <a href="#top" className={buttonClass({ variant: "ghost", size: "sm" })}>
                                Back to top
                            </a>
                        </div>
                    </article>
                </div>
            </div>
        </PublicPage>
    );
}
