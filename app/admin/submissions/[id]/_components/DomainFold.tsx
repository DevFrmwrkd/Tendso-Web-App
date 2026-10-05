"use client";

/**
 * The custom domain, inside the Details panel (board Review: the "Custom
 * domain" fold). This was /admin/submissions/[id]/domain; that route now
 * redirects here with the fold open.
 *
 * Everything the page did, it still does: the Hostinger card on file, the
 * domain's setup state (registration → DNS → SSL), the domain, order, expiry and
 * zone, a failure reason, checking a name and its alternatives, and buying one
 * (/api/admin/purchase-domain), now behind a kit dialog instead of the browser's
 * confirm(). Messages come back as toasts.
 *
 * Reads the domain fields off the submission row the workspace already
 * subscribes to — the same fields submissions/domains.getSubmissionDomainInfo
 * returned, kept live by the same subscription.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, DefList, DefRow, Dialog, Dot, Field, Input, Status, domainStatus, formatMoney } from "@/components/r1";
import { CUSTOM_DOMAIN_ADDON } from "@/lib/pricing";

import { formatDate, type SubmissionDoc } from "./review";

interface PaymentMethodStatus {
    connected: boolean;
    brand?: string;
    lastFour?: string;
    error?: string;
}

interface DomainCheckResult {
    valid: boolean;
    available?: boolean;
    domain?: string;
    priceUSD?: number;
    pricePHP?: number;
    withinBudget?: boolean;
    premium?: boolean;
    reason?: string;
    error?: string;
    suggestions?: Array<{
        domain: string;
        priceUSD: number;
        pricePHP: number;
        withinBudget: boolean;
    }>;
}

const IN_PROGRESS = ["registering", "configuring_dns", "provisioning_ssl"];
const CAN_CHECK = ["not_requested", "failed", "pending_payment"];

export function DomainFold({ s }: { s: SubmissionDoc }) {
    const submissionId = s._id;
    const [domainInput, setDomainInput] = useState(s.requestedDomain ?? "");
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<DomainCheckResult | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<PaymentMethodStatus | null>(null);

    // The Hostinger card on file. This fold mounts when it is first opened,
    // so this asks once per opening of the details, as the page did per visit.
    useEffect(() => {
        let ignore = false;
        fetch("/api/admin/hostinger-status")
            .then((r) => r.json())
            .then((data) => {
                if (!ignore) setPaymentStatus(data);
            })
            .catch(() => {
                if (!ignore) setPaymentStatus({ connected: false, error: "Failed to fetch" });
            });
        return () => {
            ignore = true;
        };
    }, []);

    const handleCheck = async (domain?: string) => {
        const target = (domain ?? domainInput).trim().toLowerCase();
        if (!target) return;

        setChecking(true);
        setResult(null);

        try {
            const response = await fetch("/api/admin/check-domain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // The custom-domain add-on is the budget a domain is checked against.
                body: JSON.stringify({ domain: target, maxBudgetPHP: CUSTOM_DOMAIN_ADDON }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "Check failed");
            } else {
                setResult(data);
                if (domain) setDomainInput(domain);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Network error");
        } finally {
            setChecking(false);
        }
    };

    const handlePurchase = async () => {
        if (!result?.available || !result?.domain) return;
        setPurchasing(true);
        try {
            const response = await fetch("/api/admin/purchase-domain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionId,
                    domain: result.domain,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                toast.error(data.error || "Purchase failed");
            } else {
                toast.success(data.message || "Purchase started");
                setResult(null);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Network error");
        } finally {
            setPurchasing(false);
            setConfirmOpen(false);
        }
    };

    const currentStatus = s.domainStatus || "not_requested";
    const isInProgress = IN_PROGRESS.includes(currentStatus);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Status {...domainStatus(currentStatus)} />
                {currentStatus === "not_requested" && <span className="t-meta">The owner didn’t ask for one.</span>}
                {s.requestedDomain && currentStatus === "live" && (
                    <a href={`https://${s.requestedDomain}`} target="_blank" rel="noopener noreferrer" className="t-link text-[13px] font-medium">
                        Visit
                    </a>
                )}
            </div>

            {s.requestedDomain && (
                <DefList>
                    <DefRow term="Domain">
                        <span className="font-r1-mono text-[13px]">{s.requestedDomain}</span>
                    </DefRow>
                    {s.registrarOrderId && (
                        <DefRow term="Order ID">
                            <span className="t-mono">{s.registrarOrderId}</span>
                        </DefRow>
                    )}
                    {s.domainExpiresAt && <DefRow term="Expires">{formatDate(s.domainExpiresAt)}</DefRow>}
                    {s.cloudflareZoneId && (
                        <DefRow term="Zone ID">
                            <span className="t-mono">{s.cloudflareZoneId}</span>
                        </DefRow>
                    )}
                </DefList>
            )}

            {s.domainFailureReason && (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="alert">
                    <Dot tone="bad" className="mt-[5px]" />
                    <span>Failure: {s.domainFailureReason}</span>
                </p>
            )}

            {/* The card Hostinger charges for a registration. */}
            {paymentStatus === null ? (
                <p className="t-meta">Checking the Hostinger payment method…</p>
            ) : paymentStatus.connected ? (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2">
                    <Dot tone="done" className="mt-[5px]" />
                    <span>
                        Hostinger pays with {paymentStatus.brand} ••••{paymentStatus.lastFour}.
                    </span>
                </p>
            ) : (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="alert">
                    <Dot tone="bad" className="mt-[5px]" />
                    <span>
                        Hostinger payment method not found{paymentStatus.error ? ` (${paymentStatus.error})` : ""}. Buying a domain will fail
                        until it is fixed in Hostinger.
                    </span>
                </p>
            )}

            {isInProgress && (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="status">
                    <Dot tone="progress" className="mt-[5px]" />
                    <span>
                        Setup in progress. The domain is being configured automatically: registration, DNS zone, attaching the site, then
                        SSL. It usually takes 2–6 minutes, and this updates by itself.
                    </span>
                </p>
            )}

            {CAN_CHECK.includes(currentStatus) && (
                <>
                    <Field label="Check a domain" help={`Checked against the ${formatMoney(CUSTOM_DOMAIN_ADDON)} custom-domain budget.`}>
                        <div className="flex gap-2">
                            <Input
                                type="text"
                                value={domainInput}
                                onChange={(e) => setDomainInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleCheck();
                                }}
                                placeholder="e.g. juansbakery.com"
                                className="font-r1-mono"
                                disabled={checking || purchasing}
                            />
                            <Button onClick={() => void handleCheck()} disabled={checking || !domainInput.trim() || purchasing}>
                                {checking ? "Checking…" : "Check"}
                            </Button>
                        </div>
                    </Field>

                    {result && (
                        <div className="flex flex-col gap-2.5">
                            {result.error && (
                                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-r1-ink-2" role="alert">
                                    <Dot tone="bad" className="mt-[5px]" />
                                    <span>{result.error}</span>
                                </p>
                            )}

                            {result.valid && result.available && (
                                <div className="flex flex-col gap-1.5">
                                    <Status tone="done" word={`${result.domain} is available`} />
                                    <span className="t-meta t-num">
                                        Costs {formatMoney(result.pricePHP ?? 0)}
                                        {typeof result.priceUSD === "number" ? ` (US$${result.priceUSD.toFixed(2)})` : ""}
                                    </span>
                                    {!result.withinBudget && (
                                        <span className="flex items-center gap-2 text-[13px] font-medium leading-[18px] text-r1-gold-ink">
                                            <Dot tone="attn" />
                                            Over the {formatMoney(CUSTOM_DOMAIN_ADDON)} budget
                                        </span>
                                    )}
                                    <Button className="self-start" onClick={() => setConfirmOpen(true)} disabled={purchasing}>
                                        {purchasing ? "Buying…" : "Buy and set up…"}
                                    </Button>
                                </div>
                            )}

                            {result.valid && !result.available && (
                                <div className="flex flex-col gap-0.5">
                                    <Status tone="bad" word={`${result.domain} is not available`} />
                                    <span className="t-meta">{result.reason || "Not available"}</span>
                                </div>
                            )}

                            {result.suggestions && result.suggestions.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="t-label">Try one of these</span>
                                    <div className="flex flex-col overflow-hidden rounded-r1 border border-r1-line">
                                        {result.suggestions.map((sug) => (
                                            <button
                                                key={sug.domain}
                                                type="button"
                                                onClick={() => void handleCheck(sug.domain)}
                                                disabled={checking || !sug.withinBudget}
                                                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-r1-line-3 bg-r1-paper px-3 text-left last:border-b-0 hover:bg-r1-fill-row disabled:cursor-not-allowed disabled:opacity-55"
                                            >
                                                <span className="min-w-0 truncate font-r1-mono text-[13px] text-r1-ink">{sug.domain}</span>
                                                <span className="t-num flex-none text-[13px] text-r1-ink-2">
                                                    {formatMoney(sug.pricePHP)}
                                                    {sug.withinBudget ? "" : " · over budget"}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <Dialog
                open={confirmOpen && !!result?.available}
                onClose={() => (purchasing ? undefined : setConfirmOpen(false))}
                title={`Buy ${result?.domain ?? "this domain"} for ${formatMoney(result?.pricePHP ?? 0)}?`}
                footer={
                    <>
                        <Button onClick={() => setConfirmOpen(false)} disabled={purchasing}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={() => void handlePurchase()} disabled={purchasing} aria-busy={purchasing}>
                            {purchasing ? "Buying…" : "Buy and set up"}
                        </Button>
                    </>
                }
            >
                <p>This will:</p>
                <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">
                    <li>Register the domain with Hostinger (year 1 included, auto-renewal off)</li>
                    <li>Create a Cloudflare zone</li>
                    <li>Attach it to the website</li>
                    <li>Wait for SSL</li>
                </ol>
                <p className="t-meta">It takes 2–6 minutes in all.</p>
            </Dialog>
        </div>
    );
}
