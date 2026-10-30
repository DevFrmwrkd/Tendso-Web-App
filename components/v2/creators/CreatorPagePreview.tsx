"use client";

import { ArrowUpRight, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

import type { CreatorCard } from '@/lib/v2/creatorTypes';
import { V2Root } from '../V2Root';
import { ShopLinkView } from './ShopLinkContent';
import styles from './CreatorPagePreview.module.css';

const FRAME_DOCUMENT = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%}</style></head><body></body></html>';
const VIEWPORTS = { phone: { width: 390, height: 760 }, desktop: { width: 1280, height: 800 } } as const;

/** A separate viewport uses the public page's real CSS/media queries, without opening its tracking route. */
export function CreatorPagePreview({ card, dirty, publicHref, paused = false }: { card: CreatorCard; dirty: boolean; publicHref?: string; paused?: boolean }) {
    const [mode, setMode] = useState<keyof typeof VIEWPORTS>('phone');
    const [frameDocument, setFrameDocument] = useState<Document | null>(null);
    const [availableWidth, setAvailableWidth] = useState(0);
    const stage = useRef<HTMLDivElement>(null);
    const frame = useRef<HTMLIFrameElement>(null);
    const viewport = VIEWPORTS[mode];
    const scale = Math.min(1, (availableWidth || viewport.width) / viewport.width);

    useEffect(() => {
        const element = stage.current;
        if (!element) return;
        const measure = () => {
            const width = element.clientWidth - 32;
            if (width > 0) setAvailableWidth(width);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!frameDocument) return;
        // Copy only styles, including next/font. No scripts, auth data or route effects enter the frame.
        let previous = '';
        const syncStyles = () => {
            const nodes = [...document.head.querySelectorAll('link[rel="stylesheet"], style:not([data-next-hide-fouc]):not([data-nextjs-hide-fouc])')];
            const signature = nodes.map(node => node.outerHTML).join('');
            if (signature === previous) return;
            previous = signature;
            frameDocument.head.querySelectorAll('[data-creator-preview-style]').forEach(node => node.remove());
            for (const node of nodes) {
                const clone = node.cloneNode(true) as Element;
                clone.setAttribute('data-creator-preview-style', '');
                frameDocument.head.appendChild(clone);
            }
        };
        syncStyles();
        const observer = new MutationObserver(syncStyles);
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [frameDocument]);

    function previewClick(event: MouseEvent<HTMLDivElement>) {
        const target = event.target as HTMLElement;
        const action = target.closest?.('a,button');
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        const href = action.getAttribute('href');
        // The public "Get the app" jump remains useful inside the preview; outgoing links stay inactive.
        if (href?.startsWith('#')) frameDocument?.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }

    return <section className={styles.preview} aria-label="Public shop page preview">
        <div className={styles.toolbar}>
            <div><h2>Shop page preview</h2><p>{paused ? 'Page paused · This preview is only visible to you.' : dirty ? 'Unsaved changes · Visitors still see your saved page.' : 'Your saved page · This is what shop owners see.'}</p></div>
            <div className={styles.modes} role="group" aria-label="Preview screen size">
                <button type="button" aria-pressed={mode === 'phone'} onClick={() => setMode('phone')}><Smartphone size={17} aria-hidden="true" />Phone</button>
                <button type="button" aria-pressed={mode === 'desktop'} onClick={() => setMode('desktop')}><Monitor size={17} aria-hidden="true" />Desktop</button>
            </div>
        </div>
        <div className={styles.address}><span aria-hidden="true">↗</span><span>{card.handle ? `tendso.com/v2/a/${card.handle}` : 'Your public shop page'}</span><small>{viewport.width}px</small></div>
        <div className={styles.stage} ref={stage}>
            <div className={styles.screen} style={{ width: viewport.width * scale, height: viewport.height * scale }}>
                <iframe
                    ref={frame}
                    title="Shop owner's page preview"
                    srcDoc={FRAME_DOCUMENT}
                    sandbox="allow-same-origin"
                    onLoad={() => setFrameDocument(frame.current?.contentDocument ?? null)}
                    style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }}
                />
            </div>
        </div>
        <div className={styles.caption}>
            <p>Scroll inside to see the full page. Links are inactive in preview.</p>
            {publicHref && <Link href={publicHref} target="_blank" rel="noopener noreferrer">Open saved page <ArrowUpRight size={15} aria-hidden="true" /></Link>}
        </div>
        {frameDocument && createPortal(
            <div onClickCapture={previewClick} onAuxClickCapture={previewClick}>
                <V2Root className="cr ag cp cp-solo"><ShopLinkView card={card} /></V2Root>
            </div>, frameDocument.body,
        )}
    </section>;
}
