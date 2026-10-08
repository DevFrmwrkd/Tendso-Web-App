"use client";

import type { ReactNode } from "react";

import {
    Button,
    Card,
    Field,
    Highlight,
    Input,
    MoneyLine,
    MoneyLines,
    RadioCards,
    Status,
    cx,
    formatMoney,
} from "@/components/r1";
import { INTAKE_QUESTIONS } from "@/lib/narrativeFromQa";
import { formatPHP, ownerTotal, type SubmissionTier } from "@/lib/pricing";

import type { StartDraft } from "../draft";
import { visibleSlots } from "../photoSlots";
import type { Quote } from "../quote";
import { StepHeader } from "./frame";

/** 9171234567 → "917 123 4567", the way the number is printed on a card. */
function spacedPhone(digits: string): string {
    return digits.length === 10 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : digits;
}

/**
 * Step 4: the last look (Round 1, board Start, "Last look").
 *
 * Everything the owner sent, each part with its way back, and the one money
 * decision on this form — the web address. On a wide desk the decision and the
 * price stand beside the summary; everywhere else they follow it.
 */
export function ReviewStep({
    draft,
    quote,
    submitting,
    onEditBasics,
    onEditAnswers,
    onEditPhotos,
    onEditPoster,
    codeEntry,
    onCodeEntry,
    codeRejected,
    onApplyCode,
    onTier,
    onDomainChange,
    domainError,
}: {
    draft: StartDraft;
    quote: Quote;
    submitting: boolean;
    onEditBasics: () => void;
    onEditAnswers: () => void;
    onEditPhotos: () => void;
    onEditPoster: () => void;
    codeEntry: string;
    onCodeEntry: (value: string) => void;
    codeRejected: boolean;
    onApplyCode: () => void;
    onTier: (wantsCustomDomain: boolean) => void;
    onDomainChange: (value: string) => void;
    /** Only once the owner has tried to send: the field does not scold at the first letter. */
    domainError: string | undefined;
}) {
    const { basics, answers, photos, hasProducts, coordinates, wantsCustomDomain, requestedDomain } = draft;
    const email = basics.ownerEmail.trim();
    const address = [basics.address, basics.barangay, basics.city, basics.province, basics.postalCode]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
    const lines = [
        { label: "Name", value: basics.businessName.trim() },
        { label: "Type", value: basics.businessType },
        { label: "Owner", value: basics.ownerName.trim() },
        { label: "Mobile", value: basics.ownerPhone ? `+63 ${spacedPhone(basics.ownerPhone)}` : "" },
        { label: "Email", value: email },
        { label: "Address", value: address },
    ].filter((line) => line.value);
    const answered = INTAKE_QUESTIONS.filter((entry) => (answers[entry.key] ?? "").trim());
    const filled = visibleSlots(!!hasProducts).filter((slot) => !!photos[slot.index]);

    return (
        <>
            <StepHeader
                title="Does this all look right?"
                sub="We build from exactly what's below. Fix anything now — after this it goes to our team."
            />

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_344px] xl:gap-6">
                <div className="flex min-w-0 flex-col gap-4">
                    <SummaryCard title="Your business" editLabel="Edit your business" onEdit={onEditBasics} disabled={submitting}>
                        {lines.map((line) => (
                            <SummaryRow key={line.label} label={line.label}>
                                {line.value}
                            </SummaryRow>
                        ))}
                        <SummaryRow label="Map pin">
                            <Status tone={coordinates ? "done" : "off"} className="whitespace-normal">
                                {coordinates ? "Placed on the map" : "Not placed — we find you from the address"}
                            </Status>
                        </SummaryRow>
                    </SummaryCard>

                    <SummaryCard
                        title={
                            <>
                                Your answers{" "}
                                <span className="t-count">
                                    {answered.length} of {INTAKE_QUESTIONS.length}
                                </span>
                            </>
                        }
                        editLabel="Edit your answers"
                        onEdit={onEditAnswers}
                        disabled={submitting}
                    >
                        {answered.map((entry, index) => (
                            <div key={entry.key} className={cx("flex min-w-0 flex-col gap-1", index > 0 && "border-t border-r1-line-3 pt-3")}>
                                <p className="t-label">{entry.q}</p>
                                {/* Answers are typed by hand into a textarea, and one
                                    long unbroken run — a URL, a string of digits, a
                                    run-on with no spaces — pushed this card wider
                                    than the screen and made the whole page scroll
                                    sideways. `anywhere` breaks mid run rather than
                                    only at spaces. */}
                                <p className="line-clamp-2 whitespace-pre-line text-sm leading-5 text-r1-ink [overflow-wrap:anywhere]">
                                    {(answers[entry.key] ?? "").trim()}
                                </p>
                            </div>
                        ))}
                    </SummaryCard>

                    <SummaryCard
                        title={
                            <>
                                Your photos <span className="t-count">{filled.length}</span>
                            </>
                        }
                        editLabel="Edit your photos"
                        onEdit={onEditPhotos}
                        disabled={submitting}
                    >
                        <div className="flex flex-wrap gap-3">
                            {filled.map((slot) => (
                                <figure key={slot.role} className="m-0 flex w-[88px] flex-col gap-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photos[slot.index]} alt={slot.label} className="h-[66px] w-[88px] rounded-r1 bg-r1-line object-cover" />
                                    <figcaption className="t-help">{slot.label}</figcaption>
                                </figure>
                            ))}
                        </div>
                    </SummaryCard>
                    {quote.giveaway ? (
                        <SummaryCard title="Your poster photo" editLabel="Edit your poster photo" onEdit={onEditPoster} disabled={submitting}>
                            {draft.giveawayPosterPhoto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={draft.giveawayPosterPhoto} alt="Your poster hanging in your business" className="max-h-56 w-full rounded-r1 object-contain bg-r1-fill-2" />
                            ) : <p className="t-error">Add your poster photo before sending your application.</p>}
                        </SummaryCard>
                    ) : null}
                </div>

                <div className="flex min-w-0 flex-col gap-4">
                    {/* The discount, and the one way back to it. Arriving from a
                        campaign link applies it without anyone typing anything —
                        the code box exists for the case that breaks: a different
                        phone, or site data cleared between seeing the offer and
                        deciding. It only changes what this page SHOWS; the
                        mutation resolves the campaign again and prices the row. */}
                    <Card pad className="flex flex-col gap-2.5">
                        <h2 className="t-label">Your price</h2>
                        {/* Exactly what lib/pricing charges this owner (see quote.ts);
                            a list price is struck only beside the figure it is the
                            list price of. */}
                        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            {quote.struckTotal !== null ? (
                                <span className="text-base tabular-nums text-r1-ink-3 line-through decoration-r1-ink-3">
                                    <span className="sr-only">Was </span>
                                    {formatPHP(quote.struckTotal)}
                                </span>
                            ) : null}
                            <span className="t-figure">
                                {quote.struckTotal !== null ? <span className="sr-only">Now </span> : null}
                                {quote.giveaway ? "Free" : formatPHP(quote.total)}
                            </span>
                        </p>
                        {quote.giveaway ? (
                            <p className="t-body">A free website with a Tendso web address, if your application qualifies.</p>
                        ) : quote.discounted ? (
                            <Status tone="done" className="whitespace-normal">
                                {quote.code ? `${quote.code} applied — ${formatPHP(quote.listPrice - quote.sellPrice)} off your website` : `${quote.percentOff}% off your website`}
                            </Status>
                        ) : (
                            <Field
                                label="Have a discount code?"
                                className="pt-1"
                                error={
                                    codeRejected
                                        ? "That code is not one of ours. Check it and try again, or carry on — the price above is what you pay."
                                        : undefined
                                }
                            >
                                <div className="flex gap-2">
                                    <Input
                                        value={codeEntry}
                                        onChange={(event) => onCodeEntry(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                onApplyCode();
                                            }
                                        }}
                                        autoComplete="off"
                                        autoCapitalize="characters"
                                        spellCheck={false}
                                        placeholder="Optional"
                                        className="min-w-0 flex-1 uppercase"
                                    />
                                    <Button onClick={onApplyCode} disabled={submitting}>
                                        Apply
                                    </Button>
                                </div>
                            </Field>
                        )}
                        {/* The domain is a registrar pass-through we buy at cost, so
                            no campaign ever touches it; the breakdown says so
                            rather than leaving the owner to work it out. With a
                            campaign, the website's own line carries its strike. */}
                        {quote.tier === "with_custom_domain" ? (
                            <MoneyLines className="pt-1">
                                <MoneyLine
                                    label="Website"
                                    meta={quote.discounted ? `${quote.percentOff}% off${quote.code ? ` with ${quote.code}` : ""}` : undefined}
                                    amount={
                                        quote.discounted ? (
                                            <>
                                                <span className="mr-2 font-normal text-r1-ink-3 line-through decoration-r1-ink-3">
                                                    <span className="sr-only">Was </span>
                                                    {formatMoney(quote.listPrice)}
                                                </span>
                                                <span className="sr-only">Now </span>
                                                {formatMoney(quote.sellPrice)}
                                            </>
                                        ) : (
                                            formatMoney(quote.sellPrice)
                                        )
                                    }
                                />
                                <MoneyLine
                                    label="Your own .com"
                                    meta={quote.discounted ? "The domain is never discounted." : undefined}
                                    amount={formatMoney(quote.addOn, "credit")}
                                />
                            </MoneyLines>
                        ) : null}
                        <p className="t-meta">{quote.giveaway ? "We review your poster photo to check eligibility. There's nothing to pay for an eligible giveaway website." : "You pay once, only after your site is live. Nothing to pay now."}</p>
                    </Card>

                    {/* The tier. The ONE money decision on this form, and the only
                        reason the custom-domain tier is reachable for an owner at
                        all — nothing else on this path writes submissionType.
                        Deliberately no availability check: /api/check-domain needs
                        a logged-in user and there is no account here, so the name
                        typed below is a request our team confirms during the
                        review they already do. */}
                    {quote.giveaway ? (
                        <Card pad className="flex flex-col gap-2">
                            <h2 className="t-h2">Your web address</h2>
                            <p className="t-body">Your free website comes with a Tendso web address.</p>
                        </Card>
                    ) : <Card pad className="flex flex-col gap-3">
                        <RadioCards<SubmissionTier>
                            name="tier"
                            legend={
                                <span className="flex flex-col gap-1 pb-1">
                                    <span className="t-h2">Your web address</span>
                                    <span className="t-meta font-normal">
                                        Every site comes with an address we set up for you. Or we can register your own .com.
                                    </span>
                                </span>
                            }
                            value={quote.tier}
                            onChange={(tier) => onTier(tier === "with_custom_domain")}
                            options={[
                                {
                                    value: "standard",
                                    title: <TierTitle label="The address we set up" price={formatPHP(ownerTotal(quote.sellPrice, "standard"))} />,
                                    meta: "Included. Nothing to arrange, nothing to renew.",
                                    disabled: submitting,
                                },
                                {
                                    value: "with_custom_domain",
                                    title: (
                                        <TierTitle label="Your own .com" price={formatPHP(ownerTotal(quote.sellPrice, "with_custom_domain"))} />
                                    ),
                                    meta: "We pay the first year; after that it's yours to renew.",
                                    disabled: submitting,
                                },
                            ]}
                            className="[&_.t-radio-text]:flex-1 xl:[&_.t-radio-grid]:grid-cols-1"
                        />

                        {wantsCustomDomain ? (
                            /* The help says what we will do, not that this
                               particular name is free — nothing on this page has
                               checked, and the owner must not read it as a
                               reservation. */
                            <Field
                                label="The address you want"
                                help="Just the address — no www. and no https://. We check it's free before we ask you for anything; if someone already owns it, we email you the closest ones we can get and you pick."
                                error={domainError}
                            >
                                <Input
                                    name="requestedDomain"
                                    type="text"
                                    inputMode="url"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    maxLength={253}
                                    placeholder="alingnena.com"
                                    disabled={submitting}
                                    value={requestedDomain}
                                    onChange={(event) => onDomainChange(event.target.value)}
                                />
                            </Field>
                        ) : null}
                    </Card>}

                    <Highlight className="flex flex-col gap-2 p-5">
                        <h2 className="text-sm font-semibold leading-5">What happens next</h2>
                        {quote.giveaway ? <p className="t-body text-r1-ink">
                            Our team reviews your application and emails{" "}
                            <strong className="font-semibold [overflow-wrap:anywhere]">{email || "the address you gave us"}</strong>{" "}
                            once it has been reviewed. If you qualify, we build your free website with a Tendso web address.
                        </p> : <p className="t-body text-r1-ink">
                            Our team builds your website and emails it to{" "}
                            <strong className="font-semibold [overflow-wrap:anywhere]">{email || "the address you gave us"}</strong> within
                            48–72 hours, with how to pay {formatPHP(quote.total)}. Nothing to pay now, nothing to install.
                        </p>}
                        {!quote.giveaway && wantsCustomDomain ? (
                            <p className="t-body text-r1-ink">That bill only goes out once we&apos;ve confirmed your .com is still free.</p>
                        ) : null}
                    </Highlight>
                </div>
            </div>
        </>
    );
}

function TierTitle({ label, price }: { label: string; price: string }) {
    return (
        <span className="flex items-baseline justify-between gap-3">
            <span>{label}</span>
            <span className="tabular-nums">{price}</span>
        </span>
    );
}

function SummaryCard({
    title,
    editLabel,
    onEdit,
    disabled,
    children,
}: {
    title: ReactNode;
    editLabel: string;
    onEdit: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <Card pad className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="t-h2">{title}</h2>
                <Button variant="ghost" size="sm" onClick={onEdit} disabled={disabled} aria-label={editLabel}>
                    Edit
                </Button>
            </div>
            {children}
        </Card>
    );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 text-sm leading-5">
            <span className="text-r1-ink-3">{label}</span>
            <span className="min-w-0 text-r1-ink [overflow-wrap:anywhere]">{children}</span>
        </div>
    );
}
