"use client";

import { QRCodeSVG } from "qrcode.react";
import { forwardRef, useId } from "react";

import { boldOfferPosterScene, POSTER_PAGE, type AffiliatePosterModel } from "@/lib/affiliatePoster";
import { v2Fonts } from "@/components/v2/fonts";

export type BoldOfferPosterProps = {
    model: AffiliatePosterModel;
    className?: string;
    omitBrandImage?: boolean;
    onImageError?: (id: "brand" | "photo", href: string) => void;
};

/** The shared point-coordinate scene, rendered unchanged for screen preview and A4 print. */
export const BoldOfferPoster = forwardRef<SVGSVGElement, BoldOfferPosterProps>(function BoldOfferPoster({ model, className, omitBrandImage = false, onImageError }, ref) {
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const titleId = `${id}-poster-title`;
    const nodes = boldOfferPosterScene(model);
    return <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${POSTER_PAGE.width} ${POSTER_PAGE.height}`}
        width={POSTER_PAGE.width}
        height={POSTER_PAGE.height}
        className={`${v2Fonts} ${className ?? ""}`.trim()}
        data-affiliate-bold-offer="true"
        role="img"
        aria-labelledby={titleId}
        style={{ fontFamily: "var(--font-v2-onest), Onest, Arial, sans-serif" }}
    >
        <title id={titleId}>{`Bold offer poster for ${model.name}: ${model.priceLabel}${model.code ? `, creator code ${model.code}` : ""}. Scan the QR to open ${model.url}.`}</title>
        <defs>
            {nodes.filter(node => node.kind === "image" && node.radius).map(node => node.kind === "image" ? (
                <clipPath id={`${id}-${node.id}-clip`} key={node.id}>
                    <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.radius} />
                </clipPath>
            ) : null)}
        </defs>
        {nodes.map(node => {
            switch (node.kind) {
                case "rect": return <rect key={node.id} data-poster-node={node.id} x={node.x} y={node.y} width={node.width} height={node.height} rx={node.radius} fill={node.fill} stroke={node.stroke} strokeWidth={node.strokeWidth} />;
                case "text": return <text key={node.id} data-poster-node={node.id} x={node.x} y={node.y} fontSize={node.fontSize} fontWeight={node.weight} fill={node.fill} textAnchor={node.anchor ?? "start"} fontFamily="var(--font-v2-onest), Onest, Arial, sans-serif">{node.text}</text>;
                case "image": return node.id === "brand" && omitBrandImage ? null : <image key={node.id} data-poster-node={node.id} x={node.x} y={node.y} width={node.width} height={node.height} href={node.href} preserveAspectRatio={node.id === "photo" ? "xMidYMid slice" : "xMidYMid meet"} clipPath={node.radius ? `url(#${id}-${node.id}-clip)` : undefined} onError={() => onImageError?.(node.id, node.href)} />;
                case "qr": return <svg key={node.id} data-poster-node={node.id} x={node.x} y={node.y} width={node.size} height={node.size} viewBox={`0 0 ${node.size} ${node.size}`}>
                    <QRCodeSVG value={node.value} size={node.size} marginSize={4} level="M" bgColor="#FFFFFF" fgColor="#0C0A08" />
                </svg>;
            }
        })}
    </svg>;
});

function loadImage(href: string): Promise<boolean> {
    return new Promise(resolve => {
        const image = new Image();
        let settled = false;
        let decoding = false;
        const finish = (loaded: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            image.onload = null;
            image.onerror = null;
            resolve(loaded);
        };
        const timer = setTimeout(() => finish(false), 8000);
        const loaded = () => {
            if (settled || decoding) return;
            decoding = true;
            Promise.resolve().then(() => typeof image.decode === "function" ? image.decode() : undefined)
                .then(() => finish(true), () => finish(false));
        };
        image.onload = loaded;
        image.onerror = () => finish(false);
        image.src = href;
        if (image.complete && image.naturalWidth > 0) loaded();
    });
}

async function waitForFonts(fontFamily: string, text: string) {
    const fonts = document.fonts;
    if (!fonts) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            (async () => {
                if (typeof fonts.load === "function") {
                    await Promise.all([400, 500, 600, 700].map(weight => fonts.load(`${weight} 16px ${fontFamily}`, text)));
                }
                await fonts.ready;
            })(),
            new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Poster fonts did not load")), 10000); }),
        ]);
    } finally { if (timeout) clearTimeout(timeout); }
}

/** Ready images are decoded before print; unavailable photos use the scene's initial avatar. */
export async function prepareAffiliatePosterForPrint(model: AffiliatePosterModel, fontFamily = "Onest, Arial, sans-serif"): Promise<{ model: AffiliatePosterModel; omitBrandImage: boolean }> {
    const images = boldOfferPosterScene(model).filter(node => node.kind === "image");
    const [loaded] = await Promise.all([
        Promise.all(images.map(async node => ({ id: node.id, loaded: await loadImage(node.href) }))),
        waitForFonts(fontFamily, `${model.name} ${model.priceLabel} ${model.code ?? ""}`),
    ]);
    return {
        model: loaded.some(image => image.id === "photo" && !image.loaded) ? { ...model, photo: null } : model,
        omitBrandImage: loaded.some(image => image.id === "brand" && !image.loaded),
    };
}
