"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";

import {
    Button,
    DefList,
    DefRow,
    Fold,
    Folds,
    Icon,
    MoreMenu,
    RowLink,
    ShowAllList,
    Skeleton,
    SkeletonText,
    Status,
    creatorStatus,
    cx,
    formatMoney,
    submissionStatus,
    type MenuItem,
    type Tone,
} from "@/components/r1";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { ROLES, ROLE_DESC, ROLE_LABEL, avatarName, fullName, payoutLines, roleLabel, roleOf, shortDate, type Role } from "../_lib/creators";
import { EmailValue, Facts, PhoneValue, ReferrerValue, Section } from "./Bits";
import { DrawerHead } from "./DrawerFrame";

/**
 * The drawer for a creator, staff member or admin (board Creators, "Drawer:
 * creator / staff / admin"). It replaces /admin/creators/[id] and carries
 * everything that page had:
 *
 *   figures      submissions, earned, balance
 *   details      email, phone, referral code, who referred them, joined
 *   role         creators.updateRole (never your own role)
 *   pricing      in a fold, what they charged each owner (getCreatorPricingSummary).
 *                Every creator has the same price band (lib/pricing.ts), so
 *                there is no per-creator ceiling to show.
 *   payout       where their money goes
 *   history      their submissions, each opening the Review screen
 *   More         Suspend / Reactivate (creators.updateStatus) and Delete
 *                (/api/delete-creator), both confirmed in a dialog
 *
 * Admins cannot be suspended or deleted, as before: the delete route refuses
 * admin accounts, and Suspend was disabled for them on the old page.
 */
export function PersonBody({
    creator,
    meId,
    titleId,
    now,
    onClose,
    onOpenCreator,
    onPickRole,
    onSuspend,
    onDelete,
}: {
    creator: Doc<"creators">;
    meId: string | null;
    titleId: string;
    now: number;
    onClose: () => void;
    onOpenCreator: (id: string) => void;
    onPickRole: (role: Role) => void;
    onSuspend: (suspend: boolean) => void;
    onDelete: (submissions: number) => void;
}) {
    const submissions = useQuery(api.submissions.getByCreatorId, { creatorId: creator._id });
    const summary = useQuery(api.submissions.getCreatorPricingSummary, { creatorId: creator._id });

    const name = fullName(creator);
    const role = roleOf(creator);
    const isAdmin = role === "admin";
    const isSelf = meId !== null && meId === creator._id;
    const suspended = creator.status === "suspended";
    const roleHeadingId = useId();

    // Counted from the submissions themselves, as the old page did. Delete
    // waits for them: its dialog says how many submissions go with the account.
    const subsCount = submissions?.length ?? 0;

    const menu: MenuItem[] = [];
    if (!isAdmin || suspended) menu.push({ label: suspended ? "Reactivate" : "Suspend", onSelect: () => onSuspend(!suspended) });
    if (!isAdmin) {
        menu.push("divider", {
            label: "Delete",
            icon: <Icon icon={Trash2} />,
            danger: true,
            disabled: submissions === undefined,
            onSelect: () => onDelete(subsCount),
        });
    }

    const status = headStatus(creator, now);
    const payout = payoutLines(creator);

    return (
        <>
            <DrawerHead
                titleId={titleId}
                name={name}
                avatar={avatarName(creator)}
                onClose={onClose}
                actions={
                    menu.length > 0 ? (
                        <MoreMenu
                            label={`More actions for ${name}`}
                            items={menu}
                            trigger={(props) => (
                                <Button variant="ghost" size="sm" icon {...props}>
                                    <Icon icon={MoreHorizontal} />
                                </Button>
                            )}
                        />
                    ) : null
                }
            >
                <span className="t-meta">{roleLabel(role)}</span>
                <Status tone={status.tone}>{status.text}</Status>
            </DrawerHead>

            <div className="t-drawer-body">
                <Facts
                    items={[
                        { label: "Submissions", value: submissions === undefined ? <Skeleton width={28} height={20} className="mt-1" /> : String(subsCount) },
                        { label: "Earned", value: formatMoney(creator.totalEarnings ?? 0) },
                        { label: "Balance", value: formatMoney(creator.balance ?? 0) },
                    ]}
                />

                <Section title="Details">
                    <DefList>
                        <DefRow term="Email">
                            <EmailValue email={creator.email} />
                        </DefRow>
                        <DefRow term="Phone">
                            <PhoneValue phone={creator.phone} />
                        </DefRow>
                        <DefRow term="Referral code">
                            {creator.referralCode ? <span className="t-mono">{creator.referralCode}</span> : <span className="text-r1-ink-3">None</span>}
                        </DefRow>
                        <DefRow term="Referred by">
                            <ReferrerValue
                                referredBy={creator.referredBy}
                                referredByName={creator.referredByName}
                                referredByCode={creator.referredByCode}
                                onOpenCreator={onOpenCreator}
                            />
                        </DefRow>
                        <DefRow term="Joined">{shortDate(creator.createdAt ?? creator._creationTime, now)}</DefRow>
                    </DefList>
                </Section>

                <Section title="Role" id={roleHeadingId} help="What they can reach. Takes effect the next time they load a page.">
                    {/*
                     * You cannot change your OWN role: an admin demoting themselves
                     * would lose the page they are standing on, and with nobody else
                     * able to promote them back it is a one-way door.
                     */}
                    <RolePicker labelledBy={roleHeadingId} value={role} disabled={isSelf} onPick={onPickRole} />
                    {isSelf && <p className="t-help">You cannot change your own role. Ask another admin.</p>}
                    {!isSelf && isAdmin && <p className="t-help">Admins can’t be suspended or deleted. Change their role to Creator first.</p>}
                </Section>

                <Section title="Payout method">
                    {payout.length ? (
                        payout.map((line) => (
                            <p key={line} className="t-body break-words">
                                {line}
                            </p>
                        ))
                    ) : (
                        <p className="t-body">Not set</p>
                    )}
                </Section>

                <Section title="Submission history" aside={submissions && submissions.length > 0 ? `${submissions.length} total` : undefined}>
                    {submissions === undefined ? (
                        <SkeletonText lines={3} />
                    ) : submissions.length === 0 ? (
                        <p className="t-meta">No submissions yet.</p>
                    ) : (
                        <ShowAllList
                            items={submissions}
                            initial={3}
                            renderItem={(s) => {
                                const st = submissionStatus(s.status, "admin");
                                return (
                                    <RowLink key={s._id} href={`/admin/submissions/${s._id}`} aria-label={`${s.businessName}, ${st.word}. Open in Review`}>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="t-row-title">{s.businessName}</span>
                                            <span className="t-meta truncate">
                                                {[s.businessType, s.city, shortDate(s._creationTime, now)].filter(Boolean).join(" · ")}
                                            </span>
                                            <Status {...st} className="mt-1 sm:hidden" />
                                        </span>
                                        <Status {...st} className="hidden sm:inline-flex" />
                                    </RowLink>
                                );
                            }}
                        />
                    )}
                </Section>

                <Folds>
                    <Fold title="What they charged owners">
                        <PricingSummary summary={summary} now={now} />
                    </Fold>
                </Folds>
            </div>
        </>
    );
}

/** The status under the name: the account state first, then certification. */
function headStatus(c: Doc<"creators">, now: number): { tone: Tone; text: string } {
    if (c.isDeleted || c.status === "deleted") return { tone: "off", text: c.deletedAt ? `Deleted ${shortDate(c.deletedAt, now)}` : "Deleted" };
    if (c.status === "suspended") return { tone: "bad", text: "Suspended · can’t sign in" };
    const s = creatorStatus(c, "admin");
    if (s.word === "Certified" && c.certifiedAt) return { tone: s.tone, text: `Certified since ${shortDate(c.certifiedAt, now)}` };
    return { tone: s.tone, text: s.word };
}

/**
 * The three roles as radio cards (board cr-role). Picking one asks first (the
 * role dialog); nothing changes until the admin confirms, so the arrow keys
 * move between cards without choosing, and Enter or Space chooses.
 */
function RolePicker({ labelledBy, value, disabled, onPick }: { labelledBy: string; value: string; disabled: boolean; onPick: (role: Role) => void }) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const current = ROLES.findIndex((r) => r === value);

    const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
        const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        refs.current[(i + step + ROLES.length) % ROLES.length]?.focus();
    };

    return (
        <div role="radiogroup" aria-labelledby={labelledBy} aria-disabled={disabled || undefined} className="flex flex-col gap-2">
            {ROLES.map((r, i) => {
                const checked = r === value;
                return (
                    <button
                        key={r}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-disabled={disabled || undefined}
                        tabIndex={checked || (current === -1 && i === 0) ? 0 : -1}
                        onKeyDown={(e) => onKeyDown(e, i)}
                        onClick={() => {
                            if (!disabled && !checked) onPick(r);
                        }}
                        className={cx(
                            "flex w-full items-start gap-3 rounded-r1 border px-4 py-3.5 text-left",
                            checked ? "border-r1-ink bg-r1-fill-2" : "border-r1-line bg-r1-paper",
                            disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                            !disabled && !checked && "hover:border-[var(--r1-line-hover)]",
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cx(
                                "mt-px size-[18px] flex-none rounded-full border-[1.5px]",
                                checked ? "border-r1-ink bg-r1-ink shadow-[inset_0_0_0_3.5px_var(--r1-paper)]" : "border-r1-line-2 bg-r1-paper",
                            )}
                        />
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium text-r1-ink">{ROLE_LABEL[r]}</span>
                            <span className="t-meta">{ROLE_DESC[r]}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

type Summary = FunctionReturnType<typeof api.submissions.getCreatorPricingSummary>;

/**
 * What they charged each owner, from the old detail page's pricing table,
 * as rows a 480px drawer can hold. Each row opens the submission in Review.
 */
function PricingSummary({ summary, now }: { summary: Summary | undefined; now: number }) {
    if (summary === undefined) return <SkeletonText lines={3} />;
    if (summary.rows.length === 0) return <p className="t-meta">No priced submissions yet.</p>;
    return (
        <div className="flex flex-col gap-3">
            <p className="t-meta">
                Average {formatMoney(summary.avgSellPrice)}
                {summary.minSellPrice > 0 && ` · range ${formatMoney(summary.minSellPrice)}–${formatMoney(summary.maxSellPrice)}`} ·{" "}
                {formatMoney(summary.lifetimeEarned)} earned from {summary.paidCount} paid
            </p>
            <ShowAllList
                items={summary.rows}
                initial={5}
                renderItem={(r) => {
                    const st = submissionStatus(r.status, "admin");
                    const parts = [
                        `Sell ${formatMoney(r.sellPrice)}`,
                        r.discountPct > 0 ? `${r.discountPct}% off` : null,
                        r.domainAddOn > 0 ? `domain ${formatMoney(r.domainAddOn)}` : null,
                        r.isComped ? "owner paid nothing (free promo)" : `owner total ${formatMoney(r.ownerTotal)}`,
                    ].filter(Boolean);
                    return (
                        <RowLink key={r.submissionId} href={`/admin/submissions/${r.submissionId}`} aria-label={`${r.businessName}: ${formatMoney(r.creatorPayout)} earned. Open in Review`}>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="t-row-title">{r.businessName}</span>
                                <span className="t-meta">{parts.join(" · ")}</span>
                                <span className="t-meta">{shortDate(r.createdAt, now)}</span>
                                <Status {...st} className="mt-1" />
                            </span>
                            <span className="flex flex-none flex-col items-end">
                                <span className="t-num font-medium text-r1-ink">{formatMoney(r.creatorPayout)}</span>
                                <span className="t-meta">earned</span>
                            </span>
                        </RowLink>
                    );
                }}
            />
        </div>
    );
}
