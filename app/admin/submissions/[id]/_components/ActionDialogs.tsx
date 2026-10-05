"use client";

/**
 * The review workspace's decisions (board Review: "Give this website free",
 * "Confirm payment received", "Reject this submission?", "Delete …?").
 *
 * Kit dialogs; the page owns every handler and flag, so what each button does
 * (the route it calls, its arguments, the order) is unchanged. Each dialog
 * states the money involved, from the row, before anything is committed.
 */

import { Button, ConfirmDialog, Dialog, Dot, Field, Input, Textarea, formatMoney } from "@/components/r1";
import { GIFTED_BY_MAX } from "@/lib/houseCreator";

const costBox = "flex flex-col gap-1 rounded-[10px] border border-r1-line bg-r1-fill-2 px-4 py-3.5";
const bullets = "m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm leading-5 text-r1-ink-2";

/**
 * PROMO — give the website to the owner for free; the creator is still paid
 * their commission. The cost is stated once, here, wherever the action starts.
 */
export function GiveFreeDialog({
    open,
    onClose,
    onConfirm,
    busy,
    businessName,
    creatorPayout,
    selfServe,
    published,
    reason,
    onReason,
    giftedBy,
    onGiftedBy,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    busy: boolean;
    businessName: string;
    creatorPayout: number;
    /** A self-serve site: the house account, not a person, is its creator. */
    selfServe: boolean;
    /** No live site, no email (the route only mails a link that resolves). */
    published: boolean;
    reason: string;
    onReason: (v: string) => void;
    giftedBy: string;
    onGiftedBy: (v: string) => void;
}) {
    const noPayout = selfServe && creatorPayout === 0;
    return (
        <Dialog
            open={open}
            onClose={busy ? () => {} : onClose}
            title="Give this website free"
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onConfirm}
                        // Self-serve sites have no real creator to name, so the
                        // admin must say who the gift is from. The route enforces
                        // this too.
                        disabled={busy || (selfServe && !giftedBy.trim())}
                        aria-busy={busy}
                    >
                        {busy ? "Giving it free…" : "Give it free"}
                    </Button>
                </>
            }
        >
            <p>
                The business owner pays nothing.{" "}
                {noPayout ? "This is a self-serve site, so there is no creator to pay." : "The creator is still paid in full."}
            </p>
            {/* The cost, stated plainly. A giveaway is real money out. */}
            <div className={costBox}>
                <span className="t-label">What it costs</span>
                <span className="t-num text-base font-semibold leading-6 text-r1-ink">
                    Owner pays {formatMoney(0)} —{" "}
                    {noPayout ? "no creator payout (self-serve)" : `creator paid ${formatMoney(creatorPayout)}`}
                </span>
                <span className="t-meta t-num">
                    {formatMoney(0)} collected, {formatMoney(creatorPayout)} paid out. This cannot be undone from the admin.
                </span>
            </div>
            <div className="flex flex-col gap-1.5">
                <span className="t-field-label">This will</span>
                <ul className={bullets}>
                    <li>
                        {noPayout
                            ? "Pay no creator commission (self-serve submission)"
                            : `Add ${formatMoney(creatorPayout)} to the creator’s withdrawable balance`}
                    </li>
                    <li>Charge the owner {formatMoney(0)} and send a “your site is live, free” email</li>
                    <li>Keep the site online for good (no payment chase, no auto-unpublish)</li>
                    <li>Record it as promo — kept out of revenue, not counted as a sale</li>
                </ul>
            </div>
            {!published && (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2">
                    <Dot tone="attn" className="mt-[5px]" />
                    <span>This site isn’t published yet, so no email will go out. The creator is still credited — publish it, then tell the owner yourself.</span>
                </p>
            )}
            {/* Self-serve sites belong to the house account, not a person, so the
                email would credit "Tendso Self-Serve". The admin names the giver
                instead — required, shown to the owner. */}
            {selfServe && (
                <Field
                    label="Gift from"
                    required
                    help={
                        <>
                            Shown to the owner. The email will say: “<strong className="font-medium text-r1-ink">{giftedBy.trim() || "…"}</strong> chose{" "}
                            <strong className="font-medium text-r1-ink">{businessName}</strong> for a free website…”
                        </>
                    }
                >
                    <Input
                        type="text"
                        value={giftedBy}
                        onChange={(e) => onGiftedBy(e.target.value)}
                        placeholder="e.g. Off the Record"
                        maxLength={GIFTED_BY_MAX}
                        disabled={busy}
                        autoFocus
                    />
                </Field>
            )}
            <Field label="Reason (optional)" help="Internal only.">
                <Input type="text" value={reason} onChange={(e) => onReason(e.target.value)} placeholder="e.g. August promo" disabled={busy} />
            </Field>
        </Dialog>
    );
}

export function MarkPaidDialog({
    open,
    onClose,
    onConfirm,
    busy,
    businessName,
    amount,
    amountNote,
    creatorPayout,
    selfServe,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    busy: boolean;
    businessName: string;
    amount: number | undefined;
    /** The campaign that priced it, if any. */
    amountNote: string | null;
    creatorPayout: number;
    selfServe: boolean;
}) {
    return (
        <Dialog
            open={open}
            onClose={busy ? () => {} : onClose}
            title="Confirm payment received"
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={onConfirm} disabled={busy} aria-busy={busy}>
                        {busy ? "Confirming…" : "Confirm payment"}
                    </Button>
                </>
            }
        >
            <p>Only do this once the owner’s Wise transfer is in the account.</p>
            <div className={`${costBox} gap-2`}>
                <div className="flex justify-between gap-3 text-sm text-r1-ink-2">
                    <span>Business</span>
                    <strong className="min-w-0 text-right font-medium text-r1-ink">{businessName}</strong>
                </div>
                {amount != null && (
                    <div className="flex justify-between gap-3 text-sm text-r1-ink-2">
                        <span>Owner paid</span>
                        <strong className="t-num text-right font-medium text-r1-ink">
                            {formatMoney(amount)}
                            {amountNote ? ` · ${amountNote}` : ""}
                        </strong>
                    </div>
                )}
                <div className="flex justify-between gap-3 text-sm text-r1-ink-2">
                    <span>Creator payout</span>
                    <strong className="t-num text-right font-medium text-r1-ink">
                        {formatMoney(creatorPayout)}
                        {selfServe ? " · self-serve" : ""}
                    </strong>
                </div>
            </div>
            <ul className={bullets}>
                <li>Sets the status to “Paid”</li>
                <li>Adds {formatMoney(creatorPayout)} to the creator’s balance and total earnings</li>
            </ul>
        </Dialog>
    );
}

export function RejectDialog({
    open,
    onClose,
    onConfirm,
    busy,
    reason,
    onReason,
    showError,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    busy: boolean;
    reason: string;
    onReason: (v: string) => void;
    /** Reject was pressed with no reason. */
    showError: boolean;
}) {
    return (
        <Dialog
            open={open}
            onClose={busy ? () => {} : onClose}
            title="Reject this submission?"
            footer={
                <>
                    <Button onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={onConfirm} disabled={busy} aria-busy={busy}>
                        {busy ? "Rejecting…" : "Reject"}
                    </Button>
                </>
            }
        >
            <p>It leaves the review queue and no site is published.</p>
            <Field
                label="Reason"
                required
                help="Saved on the submission so the next admin knows why."
                error={showError ? "Add a reason before rejecting." : undefined}
            >
                <Textarea rows={4} value={reason} onChange={(e) => onReason(e.target.value)} placeholder="Reason for rejection…" disabled={busy} />
            </Field>
        </Dialog>
    );
}

export function DeleteDialog({
    open,
    onCancel,
    onConfirm,
    busy,
    businessName,
}: {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    busy: boolean;
    businessName: string;
}) {
    return (
        <ConfirmDialog
            open={open}
            onCancel={onCancel}
            onConfirm={onConfirm}
            busy={busy}
            title={`Delete “${businessName}”?`}
            cancelLabel="Cancel"
            confirmLabel={busy ? "Deleting…" : "Delete"}
        >
            <p>This permanently removes:</p>
            <ul className={bullets}>
                <li>The business submission record</li>
                <li>The generated website and its content</li>
                <li>All media files (R2)</li>
                <li>The Cloudflare deployment</li>
                <li>The Airtable record</li>
            </ul>
            <p className="t-meta">This cannot be undone.</p>
        </ConfirmDialog>
    );
}
