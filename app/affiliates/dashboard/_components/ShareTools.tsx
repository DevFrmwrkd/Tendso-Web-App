"use client";

import { Download, Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { toast } from "sonner";

import { BoldOfferPoster, prepareAffiliatePosterForPrint } from "@/components/affiliate/BoldOfferPoster";
import { Button, Icon } from "@/components/r1";
import { createAffiliatePoster, type AffiliatePosterModel } from "@/lib/affiliatePoster";
import { CREATOR_CODE_DISCOUNT } from "@/lib/pricing";
import { CopyButton } from "./CopyButton";
import styles from "./ShareTools.module.css";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ShareTools({ handle, displayName, photo, referralCode, price, disabled = false }: {
    handle: string;
    displayName: string;
    photo?: string | null;
    referralCode?: string | null;
    price: number;
    disabled?: boolean;
}) {
    const qr = useRef<HTMLCanvasElement>(null);
    const poster = useRef<SVGSVGElement>(null);
    const sheet = useRef<HTMLElement>(null);
    const printLock = useRef(false);
    const alive = useRef(true);
    const [preparing, setPreparing] = useState(false);
    const [failedPhoto, setFailedPhoto] = useState<string>();
    const [omitBrandImage, setOmitBrandImage] = useState(false);
    const [prepared, setPrepared] = useState<{ key: string; model: AffiliatePosterModel; omitBrandImage: boolean }>();
    const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
    const sourceModel = createAffiliatePoster({ handle, displayName, photo, referralCode, price });
    const key = JSON.stringify(sourceModel);
    const model = sourceModel.photo && sourceModel.photo === failedPhoto ? { ...sourceModel, photo: null } : sourceModel;
    const latest = useRef({ key, disabled });
    latest.current = { key, disabled };
    const titleId = useId();
    const url = sourceModel.url;

    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    function download() {
        if (latest.current.disabled || !qr.current) return;
        try {
            const anchor = document.createElement("a");
            anchor.href = qr.current.toDataURL("image/png");
            anchor.download = `tendso-${handle}-qr.png`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } catch {
            toast.error("Could not download the QR. Please try again.");
        }
    }

    function imageFailed(id: "brand" | "photo", href: string) {
        if (id === "photo") setFailedPhoto(href);
        else setOmitBrandImage(true);
    }

    async function print() {
        if (!mounted || latest.current.disabled || printLock.current || !poster.current) return;
        printLock.current = true;
        setPreparing(true);
        const currentKey = key;
        const current = () => alive.current && !latest.current.disabled && latest.current.key === currentKey;
        try {
            const family = window.getComputedStyle(poster.current).getPropertyValue("--font-v2-onest").trim() || "Onest, Arial, sans-serif";
            const ready = await prepareAffiliatePosterForPrint(model, family);
            if (!current()) return;
            // Commit fallback artwork before asking the browser to capture its print page.
            flushSync(() => setPrepared({ key: currentKey, model: ready.model, omitBrandImage: omitBrandImage || ready.omitBrandImage }));
            await new Promise<void>(resolve => {
                if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
                else window.setTimeout(resolve, 0);
            });
            if (current() && sheet.current) window.print();
        } catch {
            if (current()) toast.error("Could not prepare the poster. Please try again.");
        } finally {
            printLock.current = false;
            if (alive.current) setPreparing(false);
        }
    }

    return (
        <section className="t-card t-card-pad flex flex-col gap-5" aria-labelledby="affiliate-share-heading">
            <div className="flex flex-col gap-1">
                <h2 id="affiliate-share-heading" className="t-h2">Your link and QR</h2>
                <p className="t-meta">Share your page with shop owners. The QR opens the same link.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-r1 bg-r1-fill-2 p-3">
                <span className="ap-share-url min-w-0 select-all break-all text-sm text-r1-ink">{url.replace("https://", "")}</span>
                <CopyButton value={url} label="Copy your affiliate page link" disabled={disabled} />
            </div>
            <div className="ap-qr-body flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <QRCodeCanvas ref={qr} value={url} size={768} marginSize={4} level="M" bgColor="#FFFFFF" fgColor="#111111" role="img" aria-label={`QR code for ${url}`} style={{ width: "192px", height: "192px", maxWidth: "100%" }} />
                <div className="flex w-full flex-col gap-3 sm:w-auto">
                    <Button onClick={download} disabled={disabled}><Icon icon={Download} />Download QR PNG</Button>
                </div>
            </div>
            <div className={styles.posterPreview} aria-labelledby={titleId}>
                <div className={styles.posterHeading}><h3 id={titleId}>Bold offer</h3><span>A4 poster</span></div>
                <BoldOfferPoster ref={poster} model={model} omitBrandImage={omitBrandImage} onImageError={imageFailed} className={styles.artwork} />
                <p className="t-meta">Uses your saved name, photo, creator code and page link, with the fixed {Math.round(CREATOR_CODE_DISCOUNT * 100)}% offer.</p>
                <Button onClick={print} disabled={disabled || !mounted || preparing} aria-label="Print A4 poster" aria-busy={preparing}><Icon icon={Printer} />{preparing ? "Preparing poster…" : "Print A4 poster"}</Button>
                <p className={styles.printHint} role="status" aria-live="polite">{preparing ? "Preparing the poster’s fonts and images…" : "Print on A4 paper at 100%, or save as a PDF from the print menu."}</p>
            </div>
            {mounted && !disabled && prepared?.key === key && createPortal(
                <article ref={sheet} className={styles.poster} aria-hidden="true" data-affiliate-print="true">
                    <BoldOfferPoster model={prepared.model} omitBrandImage={prepared.omitBrandImage} />
                </article>, document.body,
            )}
        </section>
    );
}
