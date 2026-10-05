"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import AdminLayout from "@/app/admin/components/AdminLayout";
import { CertificateDialog, certificateName, issuedOn } from "@/components/certificate";
import {
    Avatar,
    Button,
    Icon,
    Loading,
    PageHeader,
    RowButton,
    RowChevron,
    RowLink,
    Skeleton,
    SkeletonCard,
    SkeletonRows,
    Status,
    creatorStatus,
    submissionStatus,
    type Tone,
} from "@/components/r1";
import { CreatorShell } from "@/components/shells/CreatorShell";
import { OwnerShell } from "@/components/shells/OwnerShell";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { AiKeyCard } from "./AiKeyCard";
import { EditProfileDrawer } from "./EditProfileDrawer";
import { AccountCard, Line, LockedNote, Value, maskEmail, maskPhone, monthLong, monthShort } from "./parts";
import { PasswordDrawer } from "./PasswordDrawer";
import { PayoutDrawer } from "./PayoutDrawer";

/**
 * Account (board Account, "Account (all roles)"): is my account set up right?
 *
 * One page for everyone who signs in, in that person's own frame:
 *  - a creator             → CreatorShell
 *  - an admin or staff     → the admin frame (AdminLayout); creator-only
 *                            cards (payout, certificate, referral code) are left out
 *  - a business owner      → OwnerShell. Owners are a separate Clerk audience
 *                            with a businessOwners row and NO creators row
 *                            (hooks/useOwnerAuth), so this page used to send
 *                            them to /onboarding by mistake.
 * Only someone who is neither a creator nor an owner goes to /onboarding.
 *
 * Three old pages live here now, and their routes redirect in:
 *   /edit-profile    → ?edit=profile   (the Edit profile drawer)
 *   /change-password → ?edit=password  (the Change password drawer)
 *   /connect-ai      → ?edit=ai#ai-key (the AI key section, opened)
 * and ?certificate=1 opens the certificate (the notification links there).
 * The old profile menu (a second navigation that repeated the tab bar) and
 * "Enter referral code" (now on Referrals) are gone from here.
 */

type Overlay = "profile" | "password" | "payout" | "certificate";

/** How this person signs in, from Clerk. */
type SignInFacts = { google: boolean; hasPassword: boolean; clerkEmail?: string };

type Ready = { tone: Tone; line: string; note?: ReactNode };

export default function AccountView() {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();

    const creator = useQuery(api.creators.getByClerkId, user ? { clerkId: user.id } : "skip");
    // Asked only once we know there is no creators row: a business owner.
    const owner = useQuery(api.businessOwners.me, user && creator === null ? {} : "skip");

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/login");
    }, [isLoaded, isSignedIn, router]);

    useEffect(() => {
        if (isLoaded && isSignedIn && creator === null && owner === null) router.push("/onboarding");
    }, [isLoaded, isSignedIn, creator, owner, router]);

    if (!isLoaded || !isSignedIn || !user || creator === undefined) return <AccountFallback />;

    const signIn: SignInFacts = {
        google: user.externalAccounts.some((a) => a.provider === "google"),
        hasPassword: user.passwordEnabled,
        clerkEmail: user.primaryEmailAddress?.emailAddress,
    };

    if (creator) {
        if (creator.role === "admin" || creator.role === "staff") {
            return (
                <AdminLayout>
                    <TeamAccount creator={creator} signIn={signIn} />
                </AdminLayout>
            );
        }
        return (
            <CreatorShell>
                <CreatorAccount creator={creator} signIn={signIn} />
            </CreatorShell>
        );
    }
    if (owner) {
        return (
            <OwnerShell>
                <OwnerAccount owner={owner} signIn={signIn} />
            </OwnerShell>
        );
    }
    // No creators row and the owner lookup still loading, or on the way to /onboarding.
    return <AccountFallback />;
}

/**
 * Which drawer or dialog the URL asks for: ?edit=profile|password|payout or
 * ?certificate=1. Opening and closing rewrite the URL, so a link, a refresh
 * or the notification can open the same thing.
 *
 * window.history.replaceState, not router.replace: Next keeps useSearchParams
 * in step with it but skips the round trip to the server, so the drawer opens
 * at once. Replace, not push, so Back leaves Account instead of reopening a
 * drawer.
 */
function useOverlayParam() {
    const searchParams = useSearchParams();
    const edit = searchParams.get("edit");
    const overlay: Overlay | null =
        edit === "profile" || edit === "password" || edit === "payout" ? edit : searchParams.get("certificate") === "1" ? "certificate" : null;

    const set = (next: Overlay | null) => {
        const params = new URLSearchParams(window.location.search);
        params.delete("edit");
        params.delete("certificate");
        if (next === "certificate") params.set("certificate", "1");
        else if (next) params.set("edit", next);
        const qs = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    };

    return { overlay, edit, set };
}

// ─── Creator ─────────────────────────────────────────────────────────────────

function creatorReady(c: Doc<"creators">): Ready {
    if (!c.certifiedAt) {
        const s = creatorStatus(c, "creator");
        if (c.rejectedAt) {
            return {
                tone: s.tone,
                line: s.word,
                note: (
                    <>
                        Your application was not approved.{" "}
                        <Link className="t-link" href="/verification-rejected">
                            See why
                        </Link>
                    </>
                ),
            };
        }
        if (c.quizPassedAt) return { tone: s.tone, line: s.word, note: "The Tendso team is reviewing your application." };
        return {
            tone: s.tone,
            line: s.word,
            note: (
                <>
                    Finish the lessons and the quiz to get certified.{" "}
                    <Link className="t-link" href="/training">
                        Continue
                    </Link>
                </>
            ),
        };
    }
    if (!c.wiseEmail) return { tone: "attn", line: "Add a payout email to get paid", note: "Your certificate is done. Add your Wise email below." };
    return { tone: "done", line: "Set up to earn and get paid", note: "Profile, payout and certificate are done. The AI key is optional." };
}

function CreatorAccount({ creator, signIn }: { creator: Doc<"creators">; signIn: SignInFacts }) {
    const { overlay, edit, set } = useOverlayParam();
    const close = () => set(null);

    const name = certificateName(creator.firstName, creator.lastName);
    const email = creator.email || signIn.clerkEmail || "";
    const why = "Your name shows on your certificate and to shop owners.";
    const certifiedAt = creator.certifiedAt;

    return (
        <>
            <AccountHeader ready={creatorReady(creator)} />
            <AccountGrid
                left={
                    <>
                        <ProfileCard
                            name={name}
                            meta={creator.createdAt ? `Creator since ${monthLong(creator.createdAt)}` : "Creator"}
                            why={why}
                            email={email}
                            google={signIn.google}
                            phone={creator.phone}
                            photo={creator.profileImage}
                            onEdit={() => set("profile")}
                        />
                        <SecurityCard signIn={signIn} onChangePassword={() => set("password")} />
                    </>
                }
                right={
                    <>
                        <PayoutCard wiseEmail={creator.wiseEmail} onChange={() => set("payout")} />
                        {certifiedAt ? <CertificateRow certifiedAt={certifiedAt} onOpen={() => set("certificate")} /> : null}
                        <AiKeyCard autoOpen={edit === "ai"} />
                        <ReferralRow code={creator.referralCode} applied={!!creator.referredByCode} />
                    </>
                }
            />
            <AccountFoot />

            <EditProfileDrawer
                open={overlay === "profile"}
                onClose={close}
                creator={creator}
                why={why}
                emailLine={emailLine(email, signIn.google)}
            />
            {signIn.hasPassword && <PasswordDrawer open={overlay === "password"} onClose={close} creatorId={creator._id} />}
            <PayoutDrawer open={overlay === "payout"} onClose={close} creator={creator} />
            {certifiedAt ? (
                <CertificateDialog
                    open={overlay === "certificate"}
                    onClose={close}
                    name={name}
                    firstName={creator.firstName}
                    issued={issuedOn(certifiedAt)}
                />
            ) : null}
        </>
    );
}

// ─── Admin and staff ─────────────────────────────────────────────────────────

function TeamAccount({ creator, signIn }: { creator: Doc<"creators">; signIn: SignInFacts }) {
    const { overlay, edit, set } = useOverlayParam();
    const close = () => set(null);

    const staff = creator.role === "staff";
    const roleWord = staff ? "Staff" : "Admin";
    const name = certificateName(creator.firstName, creator.lastName);
    const email = creator.email || signIn.clerkEmail || "";
    const why = "How the team sees you in the audit log.";
    const ready: Ready = {
        tone: "done",
        line: staff ? "Signed in as staff" : "Signed in as an admin",
        note: signIn.hasPassword ? "Profile and password are set." : signIn.google ? "Profile is set. You sign in with Google." : "Profile is set.",
    };

    return (
        <>
            <AccountHeader ready={ready} />
            <AccountGrid
                left={
                    <>
                        <ProfileCard
                            name={name}
                            meta={`${roleWord} · Tendso team`}
                            why={why}
                            email={email}
                            google={signIn.google}
                            phone={creator.phone}
                            photo={creator.profileImage}
                            onEdit={() => set("profile")}
                        />
                        <SecurityCard signIn={signIn} onChangePassword={() => set("password")} />
                    </>
                }
                right={
                    <>
                        <AccountCard title="Role" meta="What you can do in Tendso.">
                            <Line label="Role">
                                <Value>{roleWord}</Value>
                                <LockedNote>Read-only. Only another admin can change a role, from Creators.</LockedNote>
                            </Line>
                        </AccountCard>
                        {/* The team has a creators row, so the AI key works for them as it
                            did on /connect-ai; it powers the help AI for everyone. */}
                        <AiKeyCard autoOpen={edit === "ai"} />
                    </>
                }
            />
            <AccountFoot />

            <EditProfileDrawer
                open={overlay === "profile"}
                onClose={close}
                creator={creator}
                why={why}
                emailLine={emailLine(email, signIn.google)}
            />
            {signIn.hasPassword && <PasswordDrawer open={overlay === "password"} onClose={close} creatorId={creator._id} />}
        </>
    );
}

// ─── Business owner ──────────────────────────────────────────────────────────

type OwnerSite = { submissionId: Id<"submissions">; businessName?: string; status: string };

function OwnerAccount({ owner, signIn }: { owner: Doc<"businessOwners">; signIn: SignInFacts }) {
    const { overlay, set } = useOverlayParam();
    const sites = useQuery(api.businessOwners.getMyWebsites, {}) as OwnerSite[] | undefined;

    const name = owner.name || owner.email;
    const business = sites?.[0]?.businessName;

    return (
        <>
            <AccountHeader ready={{ tone: "done", line: "Signed in and set up", note: "Payment and changes to your site are on My website." }} />
            <AccountGrid
                left={
                    <>
                        {/* No Convex mutation lets an owner change their own name or
                            phone yet, so the card reads only and says how to ask. */}
                        <ProfileCard
                            name={name}
                            meta={business ? `Owner of ${business}` : "Owner"}
                            why="How Tendso knows and reaches you."
                            email={owner.email}
                            google={signIn.google}
                            phone={owner.phone}
                            footer={
                                <p className="t-meta border-t border-r1-line-3 px-4 py-4 sm:px-6">
                                    To change your name or phone, email{" "}
                                    <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>
                                        {SUPPORT_EMAIL}
                                    </a>
                                    .
                                </p>
                            }
                        />
                        <SecurityCard signIn={signIn} onChangePassword={() => set("password")} />
                    </>
                }
                right={<OwnerSitesCard sites={sites} />}
            />
            <AccountFoot />

            {/* Owners have no creators row: no "Password Changed" notification, only the toast. */}
            {signIn.hasPassword && <PasswordDrawer open={overlay === "password"} onClose={() => set(null)} />}
        </>
    );
}

function OwnerSitesCard({ sites }: { sites: OwnerSite[] | undefined }) {
    if (sites === undefined) {
        return (
            <Loading label="Loading your website">
                <SkeletonRows count={1} />
            </Loading>
        );
    }
    if (sites.length === 0) {
        return (
            <AccountCard
                title="Your website"
                meta={
                    <>
                        No website is linked to this account yet. If Tendso built one for your business, email{" "}
                        <a className="t-link" href={`mailto:${SUPPORT_EMAIL}`}>
                            {SUPPORT_EMAIL}
                        </a>
                        .
                    </>
                }
            />
        );
    }
    if (sites.length === 1) {
        const s = sites[0];
        return (
            <section className="t-card overflow-hidden" aria-label="Your website">
                <RowLink href="/my-business" className="min-h-[72px] px-4 py-4 sm:px-6">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="t-h2">Your website</span>
                        {s.businessName && <span className="t-meta">{s.businessName}</span>}
                        <Status {...submissionStatus(s.status, "owner")} />
                    </span>
                    <span className="t-meta max-sm:hidden">Open My website</span>
                    <RowChevron />
                </RowLink>
            </section>
        );
    }
    return (
        <AccountCard title="Your websites" meta="Payment and changes to each site are on its page.">
            <div className="t-list border-t border-r1-line-3">
                {sites.map((s) => (
                    <RowLink key={s.submissionId} href={`/my-business/${s.submissionId}`} className="px-4 sm:px-6">
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="t-row-title">{s.businessName || "Your website"}</span>
                            <Status {...submissionStatus(s.status, "owner")} />
                        </span>
                        <RowChevron />
                    </RowLink>
                ))}
            </div>
        </AccountCard>
    );
}

// ─── Shared cards ────────────────────────────────────────────────────────────

function emailLine(email: string, google: boolean): string {
    return `${maskEmail(email) || "No email"} · ${google ? "managed by Google" : "ask support to change it"}`;
}

function AccountHeader({ ready }: { ready: Ready }) {
    return (
        <PageHeader
            title="Account"
            sub="Is my account set up right?"
            actions={
                <div className="flex flex-col gap-0.5 sm:items-end sm:pb-0.5 sm:text-right">
                    <Status tone={ready.tone} className="text-sm text-r1-ink">
                        {ready.line}
                    </Status>
                    {ready.note && <span className="t-meta">{ready.note}</span>}
                </div>
            }
        />
    );
}

/** Two columns from xl (the board's grid); one column, left then right, below that. */
function AccountGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
    return (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-6">
            <div className="flex min-w-0 flex-col gap-4">{left}</div>
            <div className="flex min-w-0 flex-col gap-4">{right}</div>
        </div>
    );
}

function ProfileCard({
    name,
    meta,
    why,
    email,
    google,
    phone,
    photo,
    onEdit,
    footer,
}: {
    name: string;
    meta: string;
    why: string;
    email: string;
    google: boolean;
    phone?: string;
    photo?: string;
    /** Left out when this person cannot edit (an owner). */
    onEdit?: () => void;
    footer?: ReactNode;
}) {
    return (
        <AccountCard
            title="Profile"
            meta={why}
            action={
                onEdit && (
                    <Button size="sm" onClick={onEdit}>
                        Edit
                    </Button>
                )
            }
        >
            <div className="flex items-center gap-4 px-4 pb-5 sm:px-6">
                {photo ? (
                    // Profile photos live on R2, outside next/image's configured hosts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="t-avatar t-avatar-lg" />
                ) : (
                    <Avatar name={name} size="lg" />
                )}
                <div className="flex min-w-0 flex-col">
                    {onEdit ? (
                        <button
                            type="button"
                            onClick={onEdit}
                            aria-label={`Edit profile: ${name}`}
                            className="min-h-10 cursor-pointer text-left text-lg font-semibold leading-6 text-r1-ink underline decoration-[var(--r1-link-line)] underline-offset-4 [overflow-wrap:anywhere] hover:decoration-r1-ink"
                        >
                            {name}
                        </button>
                    ) : (
                        <span className="text-lg font-semibold leading-6 text-r1-ink [overflow-wrap:anywhere]">{name}</span>
                    )}
                    <span className="t-meta">{meta}</span>
                </div>
            </div>
            <Line label="Email">
                <Value>{maskEmail(email) || "Not added"}</Value>
                {google && <LockedNote>Locked because you sign in with Google.</LockedNote>}
            </Line>
            <Line
                label="Phone"
                action={
                    onEdit && (
                        <Button size="sm" variant="ghost" onClick={onEdit}>
                            Edit
                        </Button>
                    )
                }
            >
                <Value className="t-num">{phone ? maskPhone(phone) : "Not added"}</Value>
            </Line>
            {footer}
        </AccountCard>
    );
}

function SecurityCard({ signIn, onChangePassword }: { signIn: SignInFacts; onChangePassword: () => void }) {
    return (
        <AccountCard title="Security" meta="How you sign in to Tendso.">
            <Line
                label="Password"
                action={
                    signIn.hasPassword && (
                        <Button size="sm" onClick={onChangePassword}>
                            Change password
                        </Button>
                    )
                }
            >
                <Value>{signIn.hasPassword ? "Set" : "Not set"}</Value>
                <span className="t-meta">
                    {signIn.hasPassword ? "At least 8 characters." : signIn.google ? "You sign in with Google." : "There is no password on this account."}
                </span>
            </Line>
            {signIn.google && (
                <Line label="Google">
                    <Status tone="done" word="Connected" />
                    <span className="t-meta">{signIn.hasPassword ? "You can sign in with Google or your password." : "You sign in with your Google account."}</span>
                </Line>
            )}
        </AccountCard>
    );
}

function PayoutCard({ wiseEmail, onChange }: { wiseEmail?: string; onChange: () => void }) {
    return (
        <AccountCard
            title="Payout method"
            meta={
                <>
                    Where your earnings go. Balance and history are on{" "}
                    <Link className="t-link" href="/wallet">
                        Wallet
                    </Link>
                    .
                </>
            }
        >
            <Line
                label="Wise"
                action={
                    <Button size="sm" onClick={onChange}>
                        {wiseEmail ? "Change" : "Set up"}
                    </Button>
                }
            >
                {wiseEmail ? (
                    <>
                        <Value>{maskEmail(wiseEmail)}</Value>
                        <Status tone="done" word="Ready for payouts" />
                    </>
                ) : (
                    <>
                        <Status tone="attn" word="Not set up" />
                        <span className="t-meta">Add the email your Wise account uses.</span>
                    </>
                )}
            </Line>
        </AccountCard>
    );
}

function CertificateRow({ certifiedAt, onOpen }: { certifiedAt: number; onOpen: () => void }) {
    return (
        <section className="t-card overflow-hidden" aria-label="Certificate">
            <RowButton className="min-h-[72px] px-4 py-4 sm:px-6" onClick={onOpen} aria-haspopup="dialog">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-h2">Certificate</span>
                    <Status tone="done" word={`Certified ${monthShort(certifiedAt)}`} />
                </span>
                <span className="t-meta">View</span>
                <RowChevron />
            </RowButton>
        </section>
    );
}

function ReferralRow({ code, applied }: { code?: string; applied: boolean }) {
    // Entering a code another creator gave you moved to Referrals; this row
    // only points there, and only offers it while no code has been applied.
    const text = code ? (
        <>
            Share yours (<span className="t-mono">{code}</span>)
            {applied ? " from Referrals." : " or enter one another creator gave you. Both live on Referrals."}
        </>
    ) : applied ? (
        "Your invites live on Referrals."
    ) : (
        "Enter one another creator gave you on Referrals."
    );
    return (
        <section className="t-card overflow-hidden" aria-label="Referral code">
            <RowLink href="/referrals" className="min-h-[72px] px-4 py-4 sm:px-6">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="t-h2">Referral code</span>
                    <span className="t-meta">{text}</span>
                </span>
                <span className="t-meta max-sm:hidden">Open Referrals</span>
                <RowChevron />
            </RowLink>
        </section>
    );
}

/** Sign out (Clerk, back to /login as before), then Help and the legal pages. */
function AccountFoot() {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-r1-line pt-4">
            <SignOutButton redirectUrl="/login">
                <Button variant="ghost">
                    <Icon icon={LogOut} />
                    Sign out
                </Button>
            </SignOutButton>
            <nav aria-label="Help and legal" className="flex items-center gap-5 text-[13px]">
                <Link className="t-link" href="/knowledge">
                    Help
                </Link>
                <Link className="t-link" href="/privacy-policy">
                    Privacy and terms
                </Link>
            </nav>
        </div>
    );
}

/**
 * While the account loads (or a redirect is on its way). The frame depends on
 * who this is, which is what is loading, so the skeleton sits where the
 * content will land inside any of the three frames.
 */
export function AccountFallback() {
    return (
        <div className="r1 min-h-dvh">
            <div className="t-main pt-[80px] sm:pt-[88px] lg:pl-[288px] lg:pt-10">
                <Loading label="Loading your account" className="flex flex-col gap-6 lg:gap-8">
                    <div className="flex flex-col gap-2">
                        <Skeleton width={180} height={36} />
                        <Skeleton width={240} height={14} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-6">
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                </Loading>
            </div>
        </div>
    );
}
