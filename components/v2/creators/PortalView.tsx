"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { fmtDate, fmtDay, fmtMonthName, firstName, peso, shopLinkFor, earnLinkFor, OVERRIDE_MONTHS } from "@/lib/v2/creatorProgram";
import type { FunnelCounts, PortalPictures, PortalRecruit, PortalShop, PortalSummary, ShopStatus } from "@/lib/v2/creatorTypes";
import { saleStatusLabel } from "@/packages/shared/affiliateSales";

import { CopyButton, ShareButton } from "./CopyButton";
import { Face, ShopThumb } from "./Face";
import { CopyIcon } from "./icons";

const WALLET_HREF = "/affiliates/dashboard/wallet";
const DISCOUNT_HREF = "/affiliates/dashboard/my-page";

const SHOP_STATUS: Record<ShopStatus, { label: string; ok: boolean }> = {
    paid: { label: "Paid", ok: true },
    paying: { label: "Paying", ok: false },
    waiting: { label: "Waiting", ok: false },
    not_paid: { label: "Not paid", ok: false },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const monthsLeftLabel = (m: number) => (m === 1 ? "1 month left" : `${m} months left`);

function ShopProgress({ shop }: { shop: PortalShop }) {
    const workflow = shop.workflowStatus?.trim();
    const paidWorkflow = workflow === 'paid' || workflow === 'completed' || (!workflow && shop.status === 'paid');
    const partial = shop.paymentStatus === 'partially_paid';
    const unpaid = shop.paymentStatus === 'unpaid';
    const label = (paidWorkflow || !workflow) && partial ? saleStatusLabel('deposit_paid')
        : paidWorkflow && unpaid ? saleStatusLabel('pending_payment')
        : workflow ? saleStatusLabel(workflow) : SHOP_STATUS[shop.status].label;
    const payment = partial ? label === saleStatusLabel('deposit_paid') ? 'Balance due' : 'Down payment received · Balance due'
        : shop.paymentStatus === 'paid_in_full' ? 'Paid in full' : unpaid ? 'No payment received' : null;
    const ok = paidWorkflow && (shop.paymentStatus === undefined || shop.paymentStatus === 'paid_in_full');
    return <div className="pt-shop-status">
        <span className={`pt-st${ok ? ' pt-st--ok' : ''}`}>{label}</span>
        {payment ? <small>{payment}</small> : null}
    </div>;
}

function CommissionStatus({ credited }: { credited?: boolean }) {
    return credited === undefined ? null : <small className="pt-commission-status">{credited ? 'Credited' : 'Not credited yet'}</small>;
}

function Months({ left }: { left: number }) {
    return (
        <span className="m" aria-hidden="true">
            {Array.from({ length: OVERRIDE_MONTHS }, (_, i) => (
                <i key={i} className={i < left ? "on" : undefined} />
            ))}
        </span>
    );
}

interface FunnelStep {
    name: string;
    value: number;
}

function funnelSteps(f: FunnelCounts, labels: { signUps: string; sales: string }): FunnelStep[] {
    return [
        { name: "Clicks", value: f.clicks },
        ...(f.downloads !== undefined ? [{ name: "Downloads", value: f.downloads }] : []),
        { name: labels.signUps, value: f.signUps },
        { name: labels.sales, value: f.sales },
    ];
}

function Funnel({ data }: { data: PortalSummary["funnel"] }) {
    const [tab, setTab] = useState<"shop" | "agent">("shop");
    const steps = tab === "shop" ? funnelSteps(data.shop, { signUps: "Sign-ups", sales: "Sales" }) : funnelSteps(data.earn, { signUps: "Joined", sales: "Sales" });
    const max = Math.max(1, steps[0]?.value ?? 1);
    return (
        <>
            <div className="pt-h">
                <h2>From click to sale</h2>
                <div className="pt-tabs" role="tablist">
                    {(["shop", "agent"] as const).map((k) => (
                        <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : undefined} onClick={() => setTab(k)}>
                            {k === "shop" ? "Shop link" : "Agent link"}
                        </button>
                    ))}
                </div>
            </div>
            <div className="pt-funnel">
                {steps.map((s, i) => {
                    const prev = steps[i - 1];
                    const ratio = prev && prev.value > 0 ? s.value / prev.value : null;
                    const note = i === 0 ? "this month" : ratio !== null && ratio <= 1 ? `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}% of ${prev!.name.toLowerCase()}` : "all time";
                    return (
                        <div className="pt-fstep" key={s.name}>
                            <span className="n">{s.name}</span>
                            <span className="bar">
                                <i style={{ "--w": `${Math.min(100, Math.sqrt(s.value / max) * 100)}%` } as CSSProperties} />
                            </span>
                            <span className="v">
                                {s.value.toLocaleString("en-US")}
                                <small>{note}</small>
                            </span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export interface PortalViewProps {
    data: PortalSummary;
    pictures?: PortalPictures;
    /** Sample data: label it, and make the buttons that would move money do nothing. */
    sample?: boolean;
    /** Prefix for the section ids, so two portals on one page cannot clash. */
    idPrefix?: string;
    /** Sample only: the payout address shown on the balance. */
    payoutTo?: string;
    /** Standalone portal: use income disclosures on phones while keeping desktop rows. */
    compactIncome?: boolean;
}

/**
 * The portal: both incomes side by side, links and code, the funnel, the field agents the creator
 * recruited, the shops that used the code, and payouts. One component draws it for the real portal
 * (/v2/creators/portal) and for the sample on /v2/creators, so what people see in the sample is
 * exactly what they get.
 */
export function PortalView({ data, pictures, sample = false, idPrefix = "pt", payoutTo, compactIncome = false }: PortalViewProps) {
    const { creator, now, monthly, recruits, shops, payouts } = data;
    const id = (s: string) => `${idPrefix}-${s}`;

    const [active, quiet] = useMemo(() => {
        const sold = recruits.filter((r) => r.salesThisMonth > 0).sort((a, b) => b.overrideThisMonth - a.overrideThisMonth || b.joinedAt - a.joinedAt);
        const rest = recruits.filter((r) => r.salesThisMonth <= 0).sort((a, b) => b.joinedAt - a.joinedAt);
        return [sold, rest] as const;
    }, [recruits]);
    const salesThisMonth = recruits.reduce((t, r) => t + r.salesThisMonth, 0);
    const keptEach = now.shops.length > 0 && now.shops.every((s) => s.kept === now.shops[0]!.kept) ? now.shops[0]!.kept : null;
    const shopLink = shopLinkFor(creator.handle);
    const earnLink = earnLinkFor(creator.handle);
    const faceOf = (name: string) => pictures?.recruits?.[name] ?? null;
    const shopPic = (name: string) => pictures?.shops?.[name] ?? null;

    const agentRow = (r: PortalRecruit) => (
        <tr key={r.creatorId} className={r.salesThisMonth > 0 ? "" : "is-quiet"}>
            <td>
                <div className="pt-who">
                    <Face src={faceOf(r.name)} name={r.name} size={40} />
                    <div>
                        <b>{r.name}</b>
                        {r.area ? <span>{r.area}</span> : null}
                    </div>
                </div>
            </td>
            <td>{fmtDate(r.joinedAt)}</td>
            <td className="num">{r.salesThisMonth || "—"}</td>
            <td className="num">
                <b>{r.overrideThisMonth ? peso(r.overrideThisMonth) : "—"}</b>
            </td>
            <td>{fmtDate(r.endsAt)}</td>
            <td>
                <div className="pt-left">
                    <Months left={r.monthsLeft} />
                    <span>{r.monthsLeft} mo</span>
                </div>
            </td>
        </tr>
    );

    const shopRow = (s: PortalShop) => (
        <tr key={s.submissionId}>
            <td>
                <div className="pt-who">
                    <ShopThumb src={shopPic(s.businessName)} name={s.businessName} />
                    <div>
                        <b>{s.businessName}</b>
                        {s.meta ? <span>{s.meta}</span> : null}
                    </div>
                </div>
            </td>
            <td>{fmtDay(s.paidAt ?? s.date)}</td>
            <td className="num">
                {s.paid < s.listPrice ? (
                    <>
                        <s style={{ color: "var(--muted)" }}>{peso(s.listPrice)}</s> {peso(s.paid)}
                    </>
                ) : (
                    peso(s.paid)
                )}
            </td>
            <td className="num">
                <b>{peso(s.kept)}</b>
                <CommissionStatus credited={s.commissionCredited} />
            </td>
            <td>
                <ShopProgress shop={s} />
            </td>
        </tr>
    );

    const payoutDone = (status: PortalSummary["payouts"]["history"][number]["status"]) => (status === "completed" ? "Done" : status === "failed" ? "Failed" : "On its way");
    const shopIncome = now.shops.length > 0 ? (
        <div className="pt-incc-list">
            {now.shops.slice(0, 3).map((s) => (
                <div key={s.submissionId}>
                    <ShopThumb src={shopPic(s.businessName)} name={s.businessName} size={32} />
                    <b>{s.businessName}</b>
                    <span className="r">{peso(s.kept)}<small>{fmtDay(s.paidAt ?? s.date)}</small></span>
                </div>
            ))}
        </div>
    ) : <p className="pt-incc-empty">No shop has paid with your code this month yet.</p>;
    const agentIncome = active.length > 0 ? (
        <div className="pt-incc-list">
            {active.slice(0, 3).map((r) => (
                <div key={r.creatorId}>
                    <Face src={faceOf(r.name)} name={r.name} size={32} />
                    <b>{r.name}</b>
                    <span className="r">{plural(r.salesThisMonth, "sale", "sales")}<small>ends {fmtDate(r.endsAt)}</small></span>
                </div>
            ))}
        </div>
    ) : <p className="pt-incc-empty">No agent of yours has sold this month yet.</p>;

    return (
        <div className="pt-view">
            <section className="pt-inc" aria-label="This month's income">
                <article className="pt-incc pt-incc--now">
                    <div className="pt-incc-top">
                        <span className="cp-pill">Money now</span>
                        <span>From shops using {creator.code ?? "your code"}</span>
                    </div>
                    <p className="pt-num">{peso(now.thisMonth)}</p>
                    <p className="pt-sub">
                        {plural(now.shopsThisMonth, "shop", "shops")} this month{keptEach !== null ? ` · ${peso(keptEach)} each` : ""}
                    </p>
                    {compactIncome ? <div className="pt-income-inline">{shopIncome}</div> : shopIncome}
                </article>
                <article className="pt-incc pt-incc--monthly">
                    <div className="pt-incc-top">
                        <span className="cp-pill">Monthly money</span>
                        <span>From your field agents</span>
                    </div>
                    <p className="pt-num">{peso(monthly.thisMonth)}</p>
                    <p className="pt-sub">
                        {plural(monthly.activeAgents, "agent", "agents")} active · {plural(salesThisMonth, "sale", "sales")}
                        {monthly.nextEndDate ? ` · next ends ${fmtDate(monthly.nextEndDate)}` : ""}
                    </p>
                    {compactIncome ? <div className="pt-income-inline">{agentIncome}</div> : agentIncome}
                </article>
                {compactIncome ? <>
                    <details className="pt-income-details">
                        <summary><span>Recent shop earnings</span><span className="pt-details-toggle" aria-hidden="true">+</span></summary>
                        {shopIncome}
                    </details>
                    <details className="pt-income-details">
                        <summary><span>Recent agent sales</span><span className="pt-details-toggle" aria-hidden="true">+</span></summary>
                        {agentIncome}
                    </details>
                </> : null}
            </section>

            <div className="pt-row2">
                <section className="pt-card" id={id("links")} aria-label="Your links and code">
                    <div className="pt-h">
                        <h2>Your links and code</h2>
                        <span>Share these anywhere</span>
                    </div>
                    <div className="pt-page-entry">
                        <div><b>Your creator page</b><p>Photo, display name, message and social links.</p></div>
                        {sample ? <a className="pt-btn pt-btn--accent" href={`#${id('links')}`}>Edit your page</a>
                            : <Link className="pt-btn pt-btn--accent" href={DISCOUNT_HREF}>Edit your page</Link>}
                    </div>
                    <div className="pt-links">
                        <div className="pt-link">
                            <span className="l">For shops</span>
                            <span className="v">{shopLink}</span>
                            <div className="acts" role="group" aria-label="Shop link actions">
                                <CopyButton className="pt-btn" text={`https://${shopLink}`}>
                                    <CopyIcon />
                                    Copy
                                </CopyButton>
                                <ShareButton className="pt-btn pt-btn--accent" url={`https://${shopLink}`} title={`${firstName(creator.name)} on Tendso`} />
                            </div>
                        </div>
                        <div className="pt-link">
                            <span className="l">For field agents</span>
                            <span className="v">{earnLink}</span>
                            <div className="acts" role="group" aria-label="Agent link actions">
                                <CopyButton className="pt-btn" text={`https://${earnLink}`}>
                                    <CopyIcon />
                                    Copy
                                </CopyButton>
                                <ShareButton className="pt-btn" url={`https://${earnLink}`} title={`Join ${firstName(creator.name)}'s team on Tendso`} />
                            </div>
                        </div>
                        <div className="pt-link">
                            <span className="l">Your code · {creator.percentOff}% off</span>
                            <span className="v pt-code">{creator.code ?? "—"}</span>
                            <div className="acts" role="group" aria-label="Discount code actions">
                                {creator.code ? (
                                    <CopyButton className="pt-btn" text={creator.code}>
                                        <CopyIcon />
                                        Copy
                                    </CopyButton>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <p className="pt-codenote" id={id("discount")}>
                        Shops pay {peso(creator.price)} and you keep {peso(Math.round(creator.price / 2))}.{" "}
                        {sample ? <a href={`#${id("discount")}`}>Change the discount</a> : <Link href={DISCOUNT_HREF}>Change the discount</Link>}
                    </p>
                </section>
                <section className="pt-card" id={id("funnel")} aria-label="From click to sale">
                    <Funnel data={data.funnel} />
                </section>
            </div>

            <section className="pt-card" id={id("agents")} aria-label="Your field agents">
                <div className="pt-h">
                    <h2>Your field agents</h2>
                    <span>
                        {recruits.length} joined through your link · {active.length} made a sale this month
                    </span>
                </div>
                {recruits.length === 0 ? (
                    <p className="pt-empty">Nobody has joined through your agent link yet. Share it when you talk about side income.</p>
                ) : (
                    <>
                        <div className="pt-tablewrap">
                            <table className="pt-table">
                                <thead>
                                    <tr>
                                        <th>Agent</th>
                                        <th>Joined</th>
                                        <th className="num">Sales this month</th>
                                        <th className="num">Your 5%</th>
                                        <th>Ends</th>
                                        <th style={{ textAlign: "right" }}>Months left</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {active.map(agentRow)}
                                    {quiet.map(agentRow)}
                                </tbody>
                            </table>
                        </div>
                        <div className="pt-cards">
                            {[...active, ...quiet].map((r) => (
                                <div className={`pt-c pt-agent-card${r.salesThisMonth > 0 ? '' : ' is-quiet'}`} key={r.creatorId}>
                                    <div className="pt-who">
                                        <Face src={faceOf(r.name)} name={r.name} size={40} />
                                        <div>
                                            <b>{r.name}</b>
                                            {r.area ? <span>{r.area}</span> : null}
                                        </div>
                                    </div>
                                    <div className="r">
                                        {r.overrideThisMonth ? peso(r.overrideThisMonth) : "—"}
                                        <small>Your 5% · {plural(r.salesThisMonth, "sale", "sales")}</small>
                                    </div>
                                    <div className="meta">
                                        <span>Joined {fmtDate(r.joinedAt)}</span>
                                        <span>{r.earning ? "Ends" : "Ended"} {fmtDate(r.endsAt)}</span>
                                    </div>
                                    <div className="pt-agent-period"><Months left={r.monthsLeft} /><span>{r.earning ? monthsLeftLabel(r.monthsLeft) : "Period ended"}</span></div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section className="pt-card" id={id("shops")} aria-label="Shops that used your code">
                <div className="pt-h">
                    <h2>Shops that used your code</h2>
                    <span>{sample ? `${fmtMonthName(data.month.start)} · ` : ""}{plural(shops.length, "shop", "shops")}</span>
                </div>
                {shops.length === 0 ? (
                    <p className="pt-empty">No shop has used your code yet. Share your shop link to get the first one.</p>
                ) : (
                    <>
                        <div className="pt-tablewrap">
                            <table className="pt-table pt-sales-table">
                                <thead>
                                    <tr>
                                        <th>Shop</th>
                                        <th>Date</th>
                                        <th className="num">Website price</th>
                                        <th className="num">Your commission</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>{shops.map(shopRow)}</tbody>
                            </table>
                        </div>
                        <div className="pt-cards">
                            {shops.map((s) => (
                                <div className="pt-c pt-sale-card" key={s.submissionId}>
                                    <div className="pt-who">
                                        <ShopThumb src={shopPic(s.businessName)} name={s.businessName} />
                                        <div>
                                            <b>{s.businessName}</b>
                                            {s.meta ? <span>{s.meta}</span> : null}
                                            <span>{fmtDay(s.paidAt ?? s.date)}</span>
                                        </div>
                                    </div>
                                    <ShopProgress shop={s} />
                                    <div className="pt-sale-money">
                                        <div><span>Website price</span><b>{peso(s.paid)}</b></div>
                                        <div><span>Your commission</span><b>{peso(s.kept)}</b><CommissionStatus credited={s.commissionCredited} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            <section className="pt-card" id={id("pay")} aria-label="Payouts">
                <div className="pt-h">
                    <h2>Payouts</h2>
                    <span>To your Wise account</span>
                </div>
                <div className="pt-pay">
                    <div className="pt-bal">
                        <span className="l">Ready to send</span>
                        <span className="big">{peso(payouts.readyToSend)}</span>
                        <span className="to">{payoutTo ? <>To Wise · <b>{payoutTo}</b></> : "To your Wise account"}</span>
                        {payouts.waitingForShops > 0 ? (
                            <div className="pt-wait">
                                <b>{peso(payouts.waitingForShops)} waiting</b>
                                <span>Some shops are still paying. You are paid when they finish.</span>
                            </div>
                        ) : null}
                        {sample || payouts.readyToSend <= 0 ? (
                            <span className="btn btn--accent" aria-disabled="true">
                                {payouts.readyToSend > 0 ? `Send ${peso(payouts.readyToSend)} to Wise` : "Nothing to send yet"}
                            </span>
                        ) : (
                            <Link className="btn btn--accent" href={WALLET_HREF}>
                                Send {peso(payouts.readyToSend)} to Wise
                            </Link>
                        )}
                    </div>
                    <div className="pt-hist">
                        {payouts.history.length === 0 ? (
                            <p className="pt-empty">Nothing sent yet. Your first payout shows here.</p>
                        ) : (
                            payouts.history.slice(0, 6).map((h) => (
                                <div key={h.withdrawalId}>
                                    <span className="d">
                                        <b>{h.status === "completed" ? "Sent to Wise" : "Requested"}</b>
                                        <span>{fmtDate(h.sentAt ?? h.requestedAt)}</span>
                                    </span>
                                    <span className={`pt-st${h.status === "completed" ? " pt-st--ok" : ""}`}>{payoutDone(h.status)}</span>
                                    <span className="a">{peso(h.amount)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <Tips />
        </div>
    );
}

function Tips(): ReactNode {
    return (
        <section className="pt-tips" aria-label="Tips">
            <p className="pt-tips-l">Tips that work</p>
            <div className="pt-tip">
                <i>1</i>Pin your shop link in your bio.
            </div>
            <div className="pt-tip">
                <i>2</i>Show a real shop’s before and after. It gets the most clicks.
            </div>
            <div className="pt-tip">
                <i>3</i>Share your agent link when you talk about side income.
            </div>
        </section>
    );
}
