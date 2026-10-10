"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { ArrowRight, Users } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EditProfileDrawer } from "@/app/profile/_components/EditProfileDrawer";
import { PasswordDrawer } from "@/app/profile/_components/PasswordDrawer";
import { maskEmail, maskPhone } from "@/app/profile/_components/parts";
import { referralStatus, shortName } from "@/app/referrals/_lib/referrals";
import { Ledger } from "@/app/wallet/_components/Ledger";
import { PayoutDialog, type PayoutStep } from "@/app/wallet/_components/PayoutDialog";
import { amountInput, checkAmount, shortDate, type LedgerRow, type Retry } from "@/app/wallet/_lib/ledger";
import { Button, ButtonLink, DefList, DefRow, EmptyState, Fold, Highlight, Icon, Loading, PageHeader, ShowAllList, Skeleton, SkeletonRows, Status, formatMoney } from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";
import { COMMISSION_RATE, REFERRAL_BONUS } from "@/lib/pricing";

import { affiliateLedger, type AffiliatePortal } from "../_lib/portal";
import { CopyButton } from "./CopyButton";

export type AffiliatePortalViewProps = {
    account: Doc<"creators">;
    portal: AffiliatePortal | undefined;
    preview?: boolean;
    hrefFor?: (section: string) => string;
};

function defaultHref(section: string): string {
    return `/affiliates/dashboard${section === "home" ? "" : `/${section}`}`;
}

function ReadOnlyNote({ preview }: Pick<AffiliatePortalViewProps, "preview">) {
    if (preview) return <p className="t-meta">Account changes and payouts are disabled in this preview.</p>;
    return null;
}

function Figure({ label, amount, note }: { label: string; amount: number | undefined; note: string }) {
    return <div className="t-card t-card-pad flex min-w-0 flex-col gap-2">
        <p className="t-label">{label}</p>
        {amount === undefined ? <Loading label={`Loading ${label.toLowerCase()}`}><Skeleton width={120} height={36} /></Loading> : <p className="t-figure">{formatMoney(amount)}</p>}
        <p className="t-meta">{note}</p>
    </div>;
}

export function AffiliateHomeView({ account, portal, preview = false, hrefFor = defaultHref }: AffiliatePortalViewProps) {
    return <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title={account.firstName ? `Hi, ${account.firstName}` : "Home"} sub="Your affiliate business at a glance." />
        <ReadOnlyNote preview={preview} />
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <Figure label="Available in your wallet" amount={portal?.summary.balance} note="Money already earned, ready for a payout." />
            <Figure label="Pending commission" amount={portal?.summary.pendingCommission} note="Lands in your wallet when shop owners pay." />
            <Figure label="Total earned" amount={portal?.summary.totalEarned} note="Your lifetime commissions and creator referral bonuses." />
        </div>
        <Highlight className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
                <p className="t-label">Share your offer</p>
                <h2 className="t-h2">Your page does the introduction.</h2>
                <p className="t-body max-w-[64ch]">Set your price, share your link, and earn {Math.round(COMMISSION_RATE * 100)}% of each website sale. Creators take photos and interview shop owners; your role is to share your offer.</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <ButtonLink variant="primary" href={hrefFor("my-page")}>My page <Icon icon={ArrowRight} /></ButtonLink>
                <ButtonLink href={hrefFor("sales")}>Sales</ButtonLink>
                <ButtonLink href={hrefFor("wallet")}>Wallet</ButtonLink>
            </div>
        </Highlight>
        <div className="t-card t-card-pad flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
                <h2 className="t-h2">Know someone who would make a good creator?</h2>
                <p className="t-meta">Earn {formatMoney(REFERRAL_BONUS)} after their first website is paid for by its owner.</p>
            </div>
            <ButtonLink href={hrefFor("referrals")} className="shrink-0">Creator referrals</ButtonLink>
        </div>
    </div>;
}

export function AffiliateWalletView(props: AffiliatePortalViewProps) {
    return <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="Wallet" sub="Your commissions and payouts, all in one place." />
        <ReadOnlyNote preview={props.preview} />
        {props.portal === undefined ? <Loading label="Loading your affiliate wallet" className="flex flex-col gap-6">
            <div className="t-card t-card-pad flex flex-col gap-4" aria-hidden="true"><Skeleton width={160} height={14} /><Skeleton width={200} height={48} /><Skeleton width="60%" height={16} /><Skeleton width={130} height={44} /></div>
            <SkeletonRows count={3} />
        </Loading> : <WalletContent key={`${props.account._id}-${props.account.status}-${props.preview ?? false}`} account={props.account} portal={props.portal} preview={props.preview ?? false} />}
    </div>;
}

function WalletContent({ account, portal, preview }: { account: Doc<"creators">; portal: AffiliatePortal; preview: boolean }) {
    const [step, setStep] = useState<PayoutStep | null>(null);
    const [amount, setAmount] = useState("");
    const [retry, setRetry] = useState<Retry | null>(null);
    const [savedEmail, setSavedEmail] = useState<{ before?: string; value: string } | null>(null);
    const balanceId = useId();
    const reasonId = useId();
    const destinationId = useId();
    const totalsId = useId();
    const { balance, totalEarned, totalWithdrawn, pendingCommission, inFlight } = portal.summary;
    const editable = !preview && account.status === "active";
    const canWithdraw = editable && balance > 0;
    const payoutEmail = savedEmail && savedEmail.before === account.wiseEmail ? savedEmail.value : account.wiseEmail?.trim() || null;
    const rows = affiliateLedger(portal);

    function startWithdraw(prefill: number, retryOf: Retry | null) {
        if (!canWithdraw) return;
        const nextAmount = amountInput(Math.min(prefill, balance));
        if (checkAmount(nextAmount, balance, true).value === null) return;
        setAmount(nextAmount);
        setRetry(retryOf);
        setStep(payoutEmail ? { mode: "withdraw" } : { mode: "setup", afterSave: "withdraw", afterCancel: null });
    }

    function retryWithdrawal(row: LedgerRow) {
        if (row.retry) startWithdraw(row.retry.amount, row.retry);
    }

    const reason = preview ? "Withdrawals are disabled in this preview."
        : !editable ? "Withdrawals are paused while your account is suspended."
        : balance <= 0 ? "Your commissions become available after shop owners pay." : null;

    return <>
        <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
                <section className="t-card flex flex-col gap-5 p-5 sm:p-8" aria-labelledby={balanceId}>
                    <div className="flex flex-col gap-3">
                        <h2 id={balanceId} className="t-label">Available to withdraw</h2>
                        <p className="t-hero-fig">{formatMoney(balance)}</p>
                        <p className="t-body">{inFlight > 0 ? `${formatMoney(inFlight)} is already in a payout request.` : pendingCommission > 0 ? `${formatMoney(pendingCommission)} arrives when shop owners pay.` : balance > 0 ? "Your earnings are in your wallet." : "Your share lands here when an owner pays."}</p>
                    </div>
                    <hr className="t-divider" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={!canWithdraw} aria-describedby={reason ? reasonId : undefined} onClick={() => startWithdraw(balance, null)}>Withdraw</Button>
                        <p id={reasonId} className="t-meta wrap-anywhere">{reason ?? (payoutEmail ? `To Wise · ${payoutEmail}` : "Add your Wise email first, then choose an amount.")}</p>
                    </div>
                </section>
                <Ledger rows={rows} canRetry={canWithdraw} onRetry={retryWithdrawal} emptyBody="When an owner pays through your page, your commission appears here. Creator referral bonuses and every withdrawal appear here too." />
            </div>
            <div className="flex min-w-0 flex-col gap-6 xl:w-[352px] xl:flex-none">
                <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby={destinationId}>
                    <h2 id={destinationId} className="t-h2">Payouts go to</h2>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <p className="t-body wrap-anywhere">{payoutEmail ? `Wise · ${payoutEmail}` : "No Wise email yet"}</p>
                            <p className="t-meta">Use the email on your Wise account.</p>
                        </div>
                        <Button disabled={!editable} className="shrink-0" onClick={() => { if (editable) setStep({ mode: "setup", afterSave: null, afterCancel: null }); }}>{payoutEmail ? "Change" : "Set up"}</Button>
                    </div>
                    <p className="t-meta">Tendso approves each payout in Wise. Wise emails you, and transfer fees are on us.</p>
                </section>
                <section className="t-card t-card-pad flex flex-col gap-3" aria-labelledby={totalsId}>
                    <h2 id={totalsId} className="t-h2">So far</h2>
                    <DefList>
                        <DefRow term="Pending commission">{formatMoney(pendingCommission)}</DefRow>
                        <DefRow term="Total earned">{formatMoney(totalEarned)}</DefRow>
                        <DefRow term="Total withdrawn">{formatMoney(totalWithdrawn)}</DefRow>
                        <DefRow term="Payouts in progress">{formatMoney(inFlight)}</DefRow>
                    </DefList>
                </section>
                <Fold title="How payouts work"><ul className="m-0 flex list-disc flex-col gap-2 pl-[18px] text-[13px] leading-[18px] text-r1-ink-2">
                    <li>Your commission lands after the shop owner pays. Domain costs are excluded from your commission.</li>
                    <li>Withdraw any amount up to your available balance.</li>
                    <li>Use the same email as your Wise account. If you need a new account, Wise is free to join.</li>
                    <li>Failed payouts return to your available balance. The latest failed payout can be tried again from its row.</li>
                </ul></Fold>
            </div>
        </div>
        {editable && <PayoutDialog step={step} onStep={setStep} creator={account} payoutEmail={payoutEmail} balance={balance} amount={amount} onAmount={setAmount} retry={retry}
            onWithdrawn={(value, email) => { setAmount(""); setRetry(null); toast.success(`${formatMoney(value)} withdrawal requested. Watch ${email} for an email from Wise.`); }}
            onEmailSaved={(email) => { setSavedEmail({ before: account.wiseEmail, value: email }); toast.success(`Saved. Payouts now go to ${email} on Wise.`); }} />}
    </>;
}

export function AffiliateReferralsView({ account, portal, preview = false }: AffiliatePortalViewProps) {
    const codeId = useId();
    const referralsId = useId();
    const code = account.referralCode || "";
    const readonly = preview || account.status !== "active";
    return <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="Creator referrals" sub="Invite someone to create websites for local shops." />
        <ReadOnlyNote preview={preview} />
        <section className="t-hl flex flex-col gap-5 p-5 sm:p-6" aria-labelledby={codeId}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2"><h2 id={codeId} className="t-label">Your creator referral code</h2>
                    {code ? <p className="select-all break-all font-r1-mono text-[28px] font-medium leading-9 tracking-[0.04em]">{code}</p> : <p className="t-body">Your code is unavailable. Contact Tendso support for help.</p>}
                </div>
                {code && <CopyButton value={code} label="Copy your creator referral code" disabled={readonly} />}
            </div>
            <div className="flex flex-col gap-1 border-t border-r1-gold-line pt-4">
                <p className="t-body">Earn {formatMoney(REFERRAL_BONUS)} when a creator who joins with your code has their first website paid for by its owner.</p>
                <p className="t-meta">Once per creator. Free promo sites do not count. Your code invites creators, not affiliates.</p>
            </div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
            <Figure label="Earned from creator referrals" amount={portal?.referralStats.totalEarned} note="Bonuses go into the same wallet as your commissions." />
            <div className="t-card t-card-pad flex flex-col gap-3"><h2 className="t-h2">Your invitations</h2>
                {portal === undefined ? <Skeleton width="75%" height={24} /> : <DefList>
                    <DefRow term="Creators invited">{portal.referralStats.total}</DefRow>
                    <DefRow term="Awaiting a first paid website">{portal.referralStats.pending}</DefRow>
                    <DefRow term="Bonuses earned">{portal.referralStats.qualified + portal.referralStats.paid}</DefRow>
                </DefList>}
            </div>
        </div>
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby={referralsId}>
            <h2 id={referralsId} className="t-h2">Creators you invited</h2>
            {portal === undefined ? <Loading label="Loading creators you invited"><SkeletonRows count={3} /></Loading>
                : portal.referrals.length === 0 ? <div className="t-card"><EmptyState icon={<Icon icon={Users} />} title="No creators invited yet" body="Share your code with someone who can take photos and interview shop owners. Their invitation appears here after they join with it." /></div>
                    : <ShowAllList items={portal.referrals} initial={5} renderItem={(referral) => <div key={referral._id} className="t-row items-start">
                        <div className="flex min-w-0 flex-1 flex-col gap-1"><p className="t-row-title wrap-anywhere">{shortName(referral.referredName)}</p><p className="t-meta">Joined {shortDate(referral.createdAt)}</p><Status {...referralStatus(referral.status)} /></div>
                        <div className="flex shrink-0 flex-col items-end gap-1"><p className="t-num text-sm font-medium text-r1-ink">{formatMoney(referral.status === "pending" ? REFERRAL_BONUS : referral.bonusAmount)}</p><p className="t-meta max-w-[130px] text-right">{referral.status === "pending" ? "After their first paid website" : "In your wallet"}</p></div>
                    </div>} />}
        </section>
    </div>;
}

export function AffiliateAccountView({ account, preview = false, hrefFor = defaultHref }: AffiliatePortalViewProps) {
    const headingId = useId();
    const name = [account.firstName, account.lastName].filter(Boolean).join(" ") || "Your affiliate account";
    return <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title="Account" sub="How Tendso knows and reaches you." />
        <ReadOnlyNote preview={preview} />
        <section className="t-card t-card-pad flex flex-col gap-4" aria-labelledby={headingId}>
            <h2 id={headingId} className="t-h2">Your details</h2>
            <DefList>
                <DefRow term="Name">{name}</DefRow>
                <DefRow term="Email">{maskEmail(account.email)}</DefRow>
                <DefRow term="Mobile">{account.phone ? maskPhone(account.phone) : "No mobile number on file"}</DefRow>
                <DefRow term="Account type">Affiliate</DefRow>
                <DefRow term="Status"><Status tone={account.status === "active" ? "done" : "off"} word={account.status === "active" ? "Active" : "Suspended"} /></DefRow>
                <DefRow term="Page handle">{account.affiliateHandle ? `/${account.affiliateHandle}` : "Not available"}</DefRow>
            </DefList>
            <p className="t-meta">One login has one account type. Use a different email to sign up as a creator.</p>
        </section>
        {preview ? <AccountActionCard><Button disabled>Edit profile</Button><Button disabled>Change password</Button><Button disabled>Sign out</Button></AccountActionCard> : <LiveAccountActions account={account} />}
        <div className="t-card t-card-pad flex flex-col items-start gap-3"><h2 className="t-h2">Your public page has its own details</h2><p className="t-body">Change the photo, display name, message, and price that shop owners see from My page.</p><ButtonLink href={hrefFor("my-page")}>My page</ButtonLink></div>
    </div>;
}

function AccountActionCard({ children }: { children: ReactNode }) {
    return <section className="t-card t-card-pad flex flex-col gap-4" aria-label="Account actions"><h2 className="t-h2">Sign-in and profile</h2><div className="flex flex-wrap gap-3">{children}</div></section>;
}

/** The preview never mounts Clerk or the profile mutation drawers. */
function LiveAccountActions({ account }: { account: Doc<"creators"> }) {
    const { user, isLoaded } = useUser();
    const [overlay, setOverlay] = useState<"profile" | "password" | null>(null);
    const editable = account.status === "active" && isLoaded && Boolean(user);
    const hasPassword = Boolean(user?.passwordEnabled);
    return <>
        <AccountActionCard>
            <Button variant="primary" disabled={!editable} onClick={() => setOverlay("profile")}>Edit profile</Button>
            <Button disabled={!editable || !hasPassword} onClick={() => setOverlay("password")}>Change password</Button>
            <SignOutButton redirectUrl="/affiliates"><Button>Sign out</Button></SignOutButton>
        </AccountActionCard>
        {isLoaded && user && !hasPassword && <p className="t-meta">Your sign-in provider manages this login. There is no Tendso password to change.</p>}
        {editable && <EditProfileDrawer open={overlay === "profile"} onClose={() => setOverlay(null)} creator={account} why="How Tendso knows and reaches you." emailLine={maskEmail(account.email)} />}
        {editable && hasPassword && <PasswordDrawer open={overlay === "password"} onClose={() => setOverlay(null)} creatorId={account._id} />}
    </>;
}
