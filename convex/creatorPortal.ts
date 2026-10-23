import { ConvexError } from 'convex/values';
import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { requireAuth } from './lib/auth';
import {
    CREATOR_OVERRIDE_MONTHS, CREATOR_OVERRIDE_RATE, WEBSITE_PRICE, clampSellPrice, creatorOverrideEndsAt,
    domainAddOnFor, earnsCreatorOverride, isComped, overrideFor, ownerChargeFor,
} from '../lib/pricing';
import { CREATOR_OVERRIDE_EARNING, creatorCard, isCreatorOwnSite, isPaidInFull, isPaidSale, paidInFullTime } from './lib/creatorRecruits';
import { hasOutstandingBalance } from './lib/ownerApp';

/**
 * The creator portal: both income streams side by side. All money is plain ₱
 * numbers; all dates are ms timestamps. "This month" is the calendar month in
 * Asia/Manila. Contract: docs/v2-api-creators.md.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const AVG_MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;

/** [start, end) of the Manila calendar month containing `now`. */
export function manilaMonth(now: number) {
    const local = new Date(now + MANILA_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    const start = Date.UTC(year, month, 1) - MANILA_OFFSET_MS;
    const end = Date.UTC(year, month + 1, 1) - MANILA_OFFSET_MS;
    return { start, end, label: `${year}-${String(month + 1).padStart(2, '0')}` };
}

/** Statuses where the shop has the site and has not paid in full yet. */
const STILL_PAYING = new Set(['deposit_paid', 'pending_payment', 'deployed']);

/** The shop has its site and has not paid in full yet (a down payment counts). */
function stillPaying(submission: Doc<'submissions'>): boolean {
    if (isPaidInFull(submission)) return false;
    return STILL_PAYING.has(submission.status) || hasOutstandingBalance(submission);
}

type ShopStage = 'paid' | 'paying' | 'waiting' | 'not_paid';

/** "Paid" means PAID IN FULL (paidInFullAt first) — the same rule the override uses. */
function shopStage(submission: Doc<'submissions'>): ShopStage {
    if (isPaidInFull(submission)) return 'paid';
    if (submission.status === 'deposit_paid' || hasOutstandingBalance(submission)) return 'paying';
    if (submission.status === 'rejected' || submission.status === 'unpublished') return 'not_paid';
    return 'waiting';
}

/** When the shop paid in full, as recorded by either payment path. */
const paidAtOf = (submission: Doc<'submissions'>) => paidInFullTime(submission);

function websitePriceOf(submission: Doc<'submissions'>): number {
    const domain = domainAddOnFor(submission.submissionType ?? 'standard', submission.domainCostPHP, submission.domainChargedPHP);
    return Math.max(0, (submission.amount ?? 0) - domain);
}

async function requireCreator(ctx: QueryCtx) {
    const identity = await requireAuth(ctx);
    const me = await ctx.db.query('creators').withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject)).unique();
    if (!me || me.role !== 'affiliate' || me.isDeleted || me.status === 'deleted') throw new ConvexError('A creator account is required.');
    if (me.status === 'pending') throw new ConvexError('Your creator account is waiting for admin approval.');
    if (me.status !== 'active' && me.status !== 'suspended') throw new ConvexError('A creator account is required.');
    return me;
}

export const summary = query({
    args: {},
    handler: async (ctx) => {
        const me = await requireCreator(ctx);
        const now = Date.now();
        const month = manilaMonth(now);
        const inMonth = (at: number | null | undefined) => at !== null && at !== undefined && at >= month.start && at < month.end;

        const [ownSales, earnings, withdrawals, recruitRows, shopClicks, earnClicks, ownerClaims] = await Promise.all([
            ctx.db.query('submissions').withIndex('by_creator_id', (q) => q.eq('creatorId', me._id)).order('desc').collect(),
            ctx.db.query('earnings').withIndex('by_creator', (q) => q.eq('creatorId', me._id)).collect(),
            ctx.db.query('withdrawals').withIndex('by_creator', (q) => q.eq('creatorId', me._id)).order('desc').collect(),
            ctx.db.query('creators').withIndex('by_recruited_by', (q) => q.eq('recruitedByCreatorId', me._id)).collect(),
            ctx.db.query('attributionClicks').withIndex('by_creator_kind', (q) => q.eq('creatorId', me._id).eq('kind', 'shop')).collect(),
            ctx.db.query('attributionClicks').withIndex('by_creator_kind', (q) => q.eq('creatorId', me._id).eq('kind', 'earn')).collect(),
            ctx.db.query('creatorAttributions').withIndex('by_creator_kind', (q) => q.eq('creatorId', me._id).eq('kind', 'owner')).collect(),
        ]);

        // ── Sell to shops (now money) ────────────────────────────────────────
        const shops = ownSales
            .filter((submission) => !submission.giveawayApplication && submission.status !== 'draft')
            .map((submission) => ({
                submissionId: submission._id,
                businessName: submission.businessName,
                date: submission._creationTime,
                paidAt: shopStage(submission) === 'paid' ? paidAtOf(submission) : null,
                listPrice: submission.websiteListPrice ?? WEBSITE_PRICE,
                paid: ownerChargeFor(submission),
                kept: submission.creatorPayout ?? 0,
                status: shopStage(submission),
            }));
        const shopsThisMonth = shops.filter((shop) => shop.status === 'paid' && inMonth(shop.paidAt));

        // ── Recruit field agents (monthly money) ─────────────────────────────
        const overrideRows = earnings.filter((row) => row.type === CREATOR_OVERRIDE_EARNING);
        const overrideSubmissions = new Map(
            (await Promise.all(overrideRows.map((row) => ctx.db.get(row.submissionId))))
                .filter((row): row is Doc<'submissions'> => !!row)
                .map((row) => [row._id, row]),
        );
        const overrideBySeller = new Map<string, { thisMonth: number; total: number }>();
        for (const row of overrideRows) {
            const seller = overrideSubmissions.get(row.submissionId)?.creatorId;
            if (!seller) continue;
            const entry = overrideBySeller.get(seller) ?? { thisMonth: 0, total: 0 };
            entry.total += row.amount;
            if (inMonth(row.createdAt)) entry.thisMonth += row.amount;
            overrideBySeller.set(seller, entry);
        }

        let recruitSalesAllTime = 0;
        let waitingOverride = 0;
        const recruits = (await Promise.all(recruitRows
            .filter((recruit) => !recruit.isDeleted && recruit.recruitedAt !== undefined && earnsCreatorOverride(recruit.recruitedAt))
            .map(async (recruit) => {
                const joinedAt = recruit.recruitedAt!;
                const endsAt = creatorOverrideEndsAt(joinedAt);
                const sales = await ctx.db.query('submissions').withIndex('by_creator_id', (q) => q.eq('creatorId', recruit._id)).order('desc').collect();
                const paid = sales.filter(isPaidSale);
                recruitSalesAllTime += paid.length;
                const salesThisMonth = paid.filter((sale) => inMonth(paidAtOf(sale))).length;
                const inWindow = now < endsAt;
                if (inWindow) {
                    for (const sale of sales) {
                        if (stillPaying(sale) && !isComped(sale) && !sale.giveawayApplication && !isCreatorOwnSite(sale, me)) {
                            waitingOverride += overrideFor(websitePriceOf(sale));
                        }
                    }
                }
                const earned = overrideBySeller.get(recruit._id) ?? { thisMonth: 0, total: 0 };
                return {
                    creatorId: recruit._id,
                    name: [recruit.firstName, recruit.lastName].filter(Boolean).join(' ') || 'New agent',
                    area: sales.find((sale) => sale.city)?.city ?? null,
                    joinedAt,
                    salesThisMonth,
                    overrideThisMonth: earned.thisMonth,
                    overrideTotal: earned.total,
                    endsAt,
                    monthsLeft: inWindow ? Math.max(1, Math.ceil((endsAt - now) / AVG_MONTH_MS)) : 0,
                    earning: inWindow,
                };
            })))
            .sort((a, b) => b.joinedAt - a.joinedAt);

        const inWindow = recruits.filter((recruit) => recruit.earning);
        const nextEnd = inWindow.reduce<number | null>((soonest, recruit) => (soonest === null || recruit.endsAt < soonest ? recruit.endsAt : soonest), null);

        // ── Payouts ──────────────────────────────────────────────────────────
        const waitingShops = ownSales
            .filter((submission) => stillPaying(submission) && submission.creatorPaidAt === undefined && !submission.giveawayApplication)
            .reduce((sum, submission) => sum + (submission.creatorPayout ?? 0), 0);
        const inFlight = withdrawals
            .filter((row) => row.status === 'pending' || row.status === 'processing')
            .reduce((sum, row) => sum + row.amount, 0);

        const price = clampSellPrice(me.affiliatePrice ?? WEBSITE_PRICE);
        return {
            creator: {
                ...creatorCard(me, price),
                status: me.status as 'active' | 'suspended',
                shopLink: `/v2/a/${me.affiliateHandle}`,
                earnLink: `/v2/a/${me.affiliateHandle}/earn`,
            },
            month,
            rates: { overrideRate: CREATOR_OVERRIDE_RATE, overrideMonths: CREATOR_OVERRIDE_MONTHS },
            now: {
                thisMonth: shopsThisMonth.reduce((sum, shop) => sum + shop.kept, 0),
                shopsThisMonth: shopsThisMonth.length,
                shops: shopsThisMonth,
            },
            monthly: {
                thisMonth: overrideRows.filter((row) => inMonth(row.createdAt)).reduce((sum, row) => sum + row.amount, 0),
                activeAgents: inWindow.filter((recruit) => recruit.salesThisMonth > 0).length,
                agentsInWindow: inWindow.length,
                nextEndDate: nextEnd,
            },
            funnel: {
                shop: {
                    clicks: shopClicks.length,
                    signUps: ownerClaims.length,
                    sales: ownSales.filter(isPaidSale).length,
                },
                earn: {
                    clicks: earnClicks.length,
                    signUps: recruits.length,
                    sales: recruitSalesAllTime,
                },
            },
            recruits,
            shops,
            payouts: {
                readyToSend: me.balance ?? 0,
                waitingForShops: waitingShops + waitingOverride,
                waitingFromShops: waitingShops,
                waitingFromTeam: waitingOverride,
                inFlight,
                history: withdrawals.map((row) => ({
                    withdrawalId: row._id,
                    amount: row.amount,
                    status: row.status,
                    requestedAt: row.createdAt,
                    sentAt: row.status === 'completed' ? (row.processedAt ?? null) : null,
                })),
            },
        };
    },
});
