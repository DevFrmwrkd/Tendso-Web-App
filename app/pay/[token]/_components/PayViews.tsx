"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCheck, CircleHelp, Clock3, Copy, Globe, LockKeyhole, ReceiptText, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ExpiredPaymentAction } from "@/components/payments/ExpiredPaymentAction";
import { PaymentPageHeader } from "@/components/shells/PaymentShell";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/contact";
import { formatPHP, isComped } from "@/lib/pricing";
import { checkoutExpiryAt, longDate, paymentDetailsText, shortDate, transferAmount, transferAmountShown } from "./payState";
import { pendingPaymentSummary, receiptSummary, safePaymentUrl, type PaymentSubmission, type PaymentToken } from "./paymentPresentation";
import styles from "./PayViews.module.css";

type ViewProps = { token: PaymentToken; submission: PaymentSubmission; now: number; publishedUrl?: string | null; ownerHome?: boolean };

async function copyText(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); toast.success(message); }
    catch { toast.error("Couldn't copy. Select the text and copy it instead."); }
}

function Badge({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "attention" | "done" }) {
    return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}><i aria-hidden="true" />{children}</span>;
}

function Business({ submission }: { submission: PaymentSubmission }) {
    return <div className={styles.business}><span className={styles.businessIcon} aria-hidden="true"><Store size={23} strokeWidth={1.6} /></span><div><p>For your business</p><h2>{submission?.businessName || "Your website"}</h2></div></div>;
}

function CopyRow({ label, value, copyValue = value }: { label: string; value: string; copyValue?: string }) {
    return <div className={styles.copyRow}><div><span>{label}</span><strong>{value}</strong></div><button type="button" className={styles.copyButton} aria-label={`Copy ${label.toLowerCase()}`} onClick={() => void copyText(copyValue, `${label} copied`)}><Copy size={15} aria-hidden="true" /><span>Copy</span></button></div>;
}

function Detail({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
    return <div className={strong ? styles.detailTotal : undefined}><dt>{label}</dt><dd>{children}</dd></div>;
}

function SupportCard({ reference }: { reference?: string }) {
    return <section className={styles.supportCard} aria-label="Payment support"><span className={styles.supportIcon} aria-hidden="true"><CircleHelp size={22} /></span><div><h2>Need a hand?</h2><p>Already sent a transfer, or unsure what to do next? Contact our team{reference ? " with your reference code" : ""}.</p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}<ArrowUpRight size={14} aria-hidden="true" /></a></div></section>;
}

function PrivacyNote() {
    return <p className={styles.privacyNote}><LockKeyhole size={14} aria-hidden="true" /><span>This link is for your business. Keep it private.</span></p>;
}

function WebsiteLink({ submission, publishedUrl, ownerHome }: Pick<ViewProps, "submission" | "publishedUrl" | "ownerHome">) {
    const url = safePaymentUrl(publishedUrl === undefined ? submission?.status === "unpublished" || submission?.unpublishedAt ? null : submission?.websiteUrl : publishedUrl);
    return <div className={styles.websiteLinks}>{url ? <a className={styles.secondaryButton} href={url} target="_blank" rel="noopener noreferrer"><Globe size={16} aria-hidden="true" />Open website<ArrowUpRight size={16} aria-hidden="true" /></a> : <p className={styles.smallNote}><LockKeyhole size={14} aria-hidden="true" />No public website link yet. Keep this page for payment updates.</p>}{ownerHome ? <Link className={styles.textLink} href="/my-business">Back to my businesses <ArrowRight size={15} aria-hidden="true" /></Link> : null}</div>;
}

/** Public transfer instructions never create a payment or mark a transfer received. */
export function PendingView({ token, submission, now, wiseEmail, publishedUrl, ownerHome }: ViewProps & { wiseEmail: string }) {
    const details = pendingPaymentSummary(token, submission);
    const covered = isComped(submission);
    const recipient = wiseEmail.trim();
    const processing = !!token.xenditCheckoutState;
    const hostedOpen = !!token.xenditInvoiceId && (token.xenditExpiresAt === undefined || token.xenditExpiresAt > now);
    const existingCheckout = !processing && hostedOpen && !details.stale ? safePaymentUrl(token.xenditInvoiceUrl) : null;
    const available = !!recipient && !details.stale && !processing && !hostedOpen;
    const money = formatPHP(token.amount);
    const kindLabel = details.kind === "deposit" ? "Down payment" : details.kind === "balance" ? "Balance payment" : "Website payment";
    const unavailableBadge = processing ? "Checking checkout" : covered ? "Order covered" : hostedOpen ? "Checkout already opened" : details.stale ? "Check latest payment" : "Transfer details unavailable";
    const unavailableTitle = processing ? "We’re checking an earlier checkout." : covered ? "No payment is needed." : hostedOpen ? "Continue your existing checkout." : details.stale ? "Let’s check your latest balance." : "Payment details aren’t ready.";
    const unavailableDescription = processing ? "An earlier checkout may still be open. Contact our team to check its status before starting another payment."
        : covered ? "Your order is covered. This old payment request no longer applies."
            : hostedOpen ? "Use the checkout already opened for this request. If you have already paid, wait for confirmation or contact our team before paying again."
            : details.stale ? "Your order or recorded payments have changed. Open your business workspace to check the current amount before sending money."
                : "Transfer details aren’t available here yet. Contact Tendso for verified payment instructions before sending money.";
    return <div className={styles.page}>
        <PaymentPageHeader eyebrow="YOUR WEBSITE PAYMENT" title="Your website payment." subtitle={available ? "Review the amount, then follow the transfer details for your business." : "Check the payment request. Our team can help with the next step."} />
        <div className={styles.layout}>
            <aside className={styles.summaryColumn} aria-label="Payment summary">
                <section className={styles.orderCard}>
                    <Business submission={submission} />
                    <Badge tone="attention">{processing ? "Checking checkout" : covered ? "No balance due" : hostedOpen ? "Checkout open" : details.stale ? "Update needed" : available ? "Awaiting payment" : "Details pending"}</Badge>
                    <div className={styles.amount}><p>{details.stale ? "Previous payment request" : `${kindLabel} requested`}</p><strong>{money}</strong><span>Philippine pesos · PHP</span></div>
                    <dl className={styles.details}>
                        <Detail label="Payment type">{kindLabel}</Detail>
                        {details.total !== null ? <Detail label="Order total">{formatPHP(details.total)}</Detail> : null}
                        {details.paid !== null && details.paid > 0 ? <Detail label="Paid so far">{formatPHP(details.paid)}</Detail> : null}
                        {details.stale && details.balance !== null ? <Detail label="Current balance" strong>{formatPHP(details.balance)}</Detail> : null}
                        {details.kind === "deposit" && details.balance !== null && !details.stale ? <Detail label="After this payment">{formatPHP(Math.max(0, details.balance - token.amount))} remaining</Detail> : null}
                        {details.kind === "full" && details.domain && details.websiteLine !== null && details.websiteLine >= 0 && details.addOn !== null ? <><Detail label="Website">{formatPHP(details.websiteLine)}</Detail><Detail label={`Domain · ${details.domain}`}>{formatPHP(details.addOn)}</Detail></> : null}
                        {details.discount ? <Detail label="Website discount">{details.discount.percentOff}% off {formatPHP(details.discount.listPrice)}</Detail> : null}
                    </dl>
                    <p className={styles.expires}><Clock3 size={15} aria-hidden="true" />This checkout ends {shortDate(checkoutExpiryAt(token), now)}.</p>
                    {available ? <button type="button" className={styles.primaryButton} onClick={() => void copyText(paymentDetailsText({ wiseEmail: recipient, accountName: OPERATOR, amount: token.amount, referenceCode: token.referenceCode }), "All payment details copied")}><Copy size={16} aria-hidden="true" />Copy all payment details</button> : null}
                    <PrivacyNote />
                </section>
                <SupportCard reference={token.referenceCode} />
            </aside>
            <div className={styles.mainColumn}>
                {available ? <section className={styles.transferCard} aria-labelledby="payment-transfer-title">
                    <div className={styles.cardHeading}><span className={styles.cardIcon} aria-hidden="true"><ArrowUpRight size={23} /></span><div><p className={styles.eyebrow}>PAY BY BANK TRANSFER</p><h2 id="payment-transfer-title">Send it with Wise.</h2><p>Use these details for this payment request.</p></div></div>
                    <ol className={styles.steps}>
                        <li><span className={styles.stepNumber}>1</span><div><h3>Check the recipient.</h3><p>In Wise, choose Send money and find the recipient using this email. Check that the account name matches.</p><div className={styles.copyGroup}><CopyRow label="Wise email" value={recipient} /><CopyRow label="Account name" value={OPERATOR} /></div><a className={styles.textLink} href={`https://wise.com/send?recipient=${encodeURIComponent(recipient)}`} target="_blank" rel="noopener noreferrer">Open Wise <ArrowUpRight size={15} aria-hidden="true" /></a></div></li>
                        <li><span className={styles.stepNumber}>2</span><div><h3>Send the exact amount in PHP.</h3><p>Set Philippine pesos as the currency the recipient receives.</p><CopyRow label="Amount" value={`${transferAmountShown(token.amount)} PHP`} copyValue={transferAmount(token.amount)} /></div></li>
                        <li><span className={styles.stepNumber}>3</span><div><h3>Add your reference code.</h3><p>Paste it into Reference or Note to recipient before you send.</p><div className={styles.reference}><span>Your reference code</span><div><strong>{token.referenceCode}</strong><button type="button" className={styles.codeButton} aria-label="Copy reference code" onClick={() => void copyText(token.referenceCode, "Reference code copied. Paste it in the transfer note.")}><Copy size={15} aria-hidden="true" />Copy code</button></div><p><ShieldCheck size={16} aria-hidden="true" />This code connects the transfer to your website. Transfers without it need team verification.</p></div></div></li>
                    </ol>
                </section> : <section className={styles.unavailableCard} aria-labelledby="payment-unavailable-title"><span className={styles.stateIcon} aria-hidden="true"><Clock3 size={28} /></span><Badge tone="attention">{unavailableBadge}</Badge><h2 id="payment-unavailable-title">{unavailableTitle}</h2><p>{unavailableDescription}</p><p className={styles.referenceText}>This link’s reference: <strong>{token.referenceCode}</strong></p><div className={styles.inlineActions}>{existingCheckout ? <a className={styles.primaryButton} href={existingCheckout}>Continue checkout <ArrowUpRight size={16} aria-hidden="true" /></a> : <Link className={styles.primaryButton} href={`/my-business/${encodeURIComponent(token.submissionId)}`}>View business payment <ArrowRight size={16} aria-hidden="true" /></Link>}<Link className={styles.secondaryButton} href="/contact">Contact Tendso</Link></div></section>}
                <section className={styles.nextCard} aria-label="What happens after you pay"><span className={styles.nextIcon} aria-hidden="true"><ReceiptText size={23} /></span><div><h2>Already sent it? Keep this page.</h2><p>This page updates when your payment is confirmed. If your transfer needs review, the team verifies it before it is recorded. Check its status before sending another payment.</p><WebsiteLink submission={submission} publishedUrl={publishedUrl} ownerHome={ownerHome} /></div></section>
                <details className={styles.faq}><summary>Paying from abroad, or need another way to pay?<span aria-hidden="true">+</span></summary><p>Choose PHP as the currency Tendso receives and keep the reference code in the transfer note. If Wise isn’t an option, <Link href="/contact">contact Tendso</Link> to check the available payment methods.</p></details>
            </div>
        </div>
    </div>;
}

/** An individual receipt and the order's remaining balance are separate facts. */
export function PaidView({ token, submission, now, ownerHome, publishedUrl }: ViewProps & { ownerHome: boolean }) {
    const receipt = receiptSummary(token, submission);
    const settled = receipt.balance === 0;
    const covered = isComped(submission);
    const title = !receipt.confirmed ? covered ? "No balance due." : "Your payment is recorded." : receipt.kind === "deposit" ? "Down payment received." : receipt.kind === "balance" ? "Balance payment received." : "Payment received.";
    return <div className={styles.page}>
        <PaymentPageHeader eyebrow="PAYMENT UPDATE" title={title} subtitle={covered ? "This order is covered. No payment is needed." : settled ? "Your order is paid in full. Keep this page for your records." : receipt.balance !== null ? `${formatPHP(receipt.balance)} remains on your order.` : "Contact the team to check your remaining balance."} />
        <div className={styles.layout}>
            <aside className={styles.summaryColumn} aria-label="Order status"><section className={styles.orderCard}><Business submission={submission} /><Badge tone="done">{covered ? "No balance due" : settled ? "Paid in full" : "Payment recorded"}</Badge><dl className={styles.details}>
                {receipt.total !== null ? <Detail label="Order total">{formatPHP(receipt.total)}</Detail> : null}
                {receipt.paid !== null ? <Detail label="Paid so far">{formatPHP(receipt.paid)}</Detail> : null}
                {receipt.balance !== null ? <Detail label="Balance due" strong>{formatPHP(receipt.balance)}</Detail> : null}
            </dl>{!settled ? <Link className={styles.primaryButton} href={`/my-business/${encodeURIComponent(token.submissionId)}`}>View balance payment <ArrowRight size={16} aria-hidden="true" /></Link> : null}<PrivacyNote /></section><SupportCard reference={token.referenceCode} /></aside>
            <div className={styles.mainColumn}>
                <section className={styles.receiptCard} aria-label="Payment receipt"><div className={styles.receiptTop}><span className={styles.receiptIcon} aria-hidden="true"><CheckCheck size={31} strokeWidth={1.6} /></span><Badge tone="done">{receipt.confirmed ? "Payment confirmed" : covered ? "Order covered" : "Order settled"}</Badge></div><p className={styles.eyebrow}>{receipt.confirmed ? receipt.kind === "deposit" ? "DOWN PAYMENT RECEIVED" : receipt.kind === "balance" ? "BALANCE PAYMENT RECEIVED" : "PAYMENT RECEIVED" : "ORDER PAYMENT STATUS"}</p>{receipt.receivedAmount !== null ? <h2 className={styles.receivedAmount}>{formatPHP(receipt.receivedAmount)}</h2> : <h2>{covered ? "Your order is covered." : "Payment recorded for your order."}</h2>}<p className={styles.receiptDescription}>{receipt.confirmed ? "This is the confirmed payment for this reference." : covered ? "No payment is due for this order. This link does not identify a confirmed cash payment." : "Your order has been settled. This older link does not identify a separate confirmed transfer."}</p><dl className={styles.receiptDetails}>
                    <Detail label="Business">{submission?.businessName || "Your website"}</Detail>
                    <Detail label={receipt.confirmed ? "Reference code" : "This link’s reference"}><span className={styles.mono}>{token.referenceCode}</span></Detail>
                    {receipt.receivedAt !== null ? <Detail label="Confirmed on">{longDate(receipt.receivedAt)}</Detail> : null}
                    {receipt.method ? <Detail label="Payment method">{receipt.method}</Detail> : null}
                </dl><p className={styles.receiptFine}><ShieldCheck size={15} aria-hidden="true" />{receipt.confirmed ? `Confirmed${receipt.receivedAt !== null ? ` ${shortDate(receipt.receivedAt, now)}` : ""}. No need to send this payment again.` : covered ? "No payment is needed for this order." : "No new payment is needed for this settled order."}</p></section>
                <section className={styles.nextCard} aria-label="Your website"><span className={styles.nextIcon} aria-hidden="true"><Globe size={23} /></span><div><h2>Your website, next.</h2><p>{covered ? "Your order is covered. Your website’s publication status is shown separately below." : settled ? "Payment is complete. Your website’s publication status is shown separately below." : "Your payment is recorded. Any remaining balance needs to be paid before a pay-first website can be published."}</p><WebsiteLink submission={submission} publishedUrl={publishedUrl} ownerHome={ownerHome} /></div></section>
            </div>
        </div>
    </div>;
}

export function ExpiredView({ token, submission, now }: ViewProps) {
    return <div className={styles.page}><PaymentPageHeader eyebrow="PAYMENT UPDATE" title="This payment link expired." subtitle="Your business and confirmed payments are still saved. Open a fresh checkout when you’re ready." /><div className={styles.layout}>
        <aside className={styles.summaryColumn} aria-label="Expired payment"><section className={styles.orderCard}><Business submission={submission} /><Badge tone="attention">Link expired</Badge><dl className={styles.details}><Detail label="Ended on">{longDate(checkoutExpiryAt(token))}</Detail><Detail label="Old reference"><span className={styles.mono}>{token.referenceCode}</span></Detail></dl><p className={styles.smallNote}>The old amount may have changed. Your current balance is checked before a new checkout opens.</p><PrivacyNote /></section><SupportCard reference={token.referenceCode} /></aside>
        <section className={styles.recoveryCard} aria-labelledby="payment-expired-title"><span className={styles.stateIcon} aria-hidden="true"><Clock3 size={28} /></span><h2 id="payment-expired-title">Ready when you are.</h2><p>This checkout ended {shortDate(checkoutExpiryAt(token), now)}. Pay again checks the latest amount and keeps any confirmed down payment.</p><div className={styles.recoveryAction}><ExpiredPaymentAction token={token} total={submission?.amount} /></div><p className={styles.recoveryNote}><TriangleAlert size={17} aria-hidden="true" />Already sent a transfer? Check that payment with our team before sending money again.</p><Link className={styles.textLink} href="/contact">Get help with a payment <ArrowUpRight size={15} aria-hidden="true" /></Link></section>
    </div></div>;
}

export function NotFoundView() {
    return <div className={styles.centered}><section className={styles.recoveryCard}><span className={styles.stateIcon} aria-hidden="true"><ReceiptText size={29} /></span><Badge>Link unavailable</Badge><h1>We can’t find this payment link.</h1><p>It may be incomplete or replaced by a newer one. Open the payment email again and tap the full link.</p><div className={styles.inlineActions}><Link className={styles.primaryButton} href="/contact">Contact Tendso <ArrowRight size={16} aria-hidden="true" /></Link><Link className={styles.secondaryButton} href="/">Go to tendso.com</Link></div><p className={styles.smallNote}>Please do not send money until you have a working link.</p></section><SupportCard /></div>;
}

export function PayLoading() {
    return <div className={styles.page} role="status" aria-label="Loading your payment details" aria-busy="true"><span className="sr-only">Loading your payment details</span><div className={styles.skeletonHeader} aria-hidden="true"><i /><i /></div><div className={styles.loadingLayout} aria-hidden="true"><div className={styles.loadingCard}><i /><i /><i /></div><div className={styles.loadingCard}><i /><i /><i /></div></div></div>;
}
