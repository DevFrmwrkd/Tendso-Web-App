"use client";

import { Download, Printer } from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button, Icon } from "@/components/r1";
import { CopyButton } from "./CopyButton";
import { OfferPrice } from "./OfferPreview";
import styles from "./ShareTools.module.css";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ShareTools({ handle, displayName, price, disabled = false }: {
    handle: string;
    displayName: string;
    price: number;
    disabled?: boolean;
}) {
    const qr = useRef<HTMLCanvasElement>(null);
    const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
    const url = `https://tendso.com/a/${encodeURIComponent(handle)}`;

    function download() {
        if (!qr.current) return;
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

    return (
        <section className="t-card t-card-pad flex flex-col gap-5" aria-labelledby="affiliate-share-heading">
            <div className="flex flex-col gap-1">
                <h2 id="affiliate-share-heading" className="t-h2">Your link and QR</h2>
                <p className="t-meta">Share your page with shop owners. The QR opens the same link.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-r1 bg-r1-fill-2 p-3">
                <span className="min-w-0 select-all break-all text-sm text-r1-ink">{url.replace("https://", "")}</span>
                <CopyButton value={url} label="Copy your affiliate page link" disabled={disabled} />
            </div>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <QRCodeCanvas ref={qr} value={url} size={768} marginSize={4} level="M" bgColor="#FFFFFF" fgColor="#111111" role="img" aria-label={`QR code for ${url}`} style={{ width: "192px", height: "192px", maxWidth: "100%" }} />
                <div className="flex w-full flex-col gap-3 sm:w-auto">
                    <Button onClick={download} disabled={disabled}><Icon icon={Download} />Download QR PNG</Button>
                    <Button onClick={() => window.print()} disabled={disabled || !mounted}><Icon icon={Printer} />Print A4 poster</Button>
                    <p className="t-meta">Print on A4 paper, or save as a PDF from the print menu.</p>
                </div>
            </div>
            {mounted && !disabled && createPortal(
                <article className={`${styles.poster} r1`} aria-hidden="true">
                    <p className={styles.brand}>tendso</p>
                    <p className={styles.byline}>{displayName || "Your Tendso affiliate"}</p>
                    <h1 className={styles.headline}>Your shop.<br />Online.</h1>
                    <p className={styles.intro}>Get a website for your business.</p>
                    <div className={styles.price}><OfferPrice price={price} /><p>One-time payment</p></div>
                    <QRCodeSVG value={url} size={320} marginSize={4} level="M" bgColor="#FFFFFF" fgColor="#111111" className={styles.qr} />
                    <p className={styles.scan}>Scan to order your website</p>
                    <p className={styles.url}>{url.replace("https://", "")}</p>
                </article>, document.body,
            )}
        </section>
    );
}
