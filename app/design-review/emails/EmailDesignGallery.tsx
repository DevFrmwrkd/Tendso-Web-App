'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { EmailPreviewFamily } from '@/lib/email/previewSamples';
import { previewDocument } from './previewDocument';
import styles from './gallery.module.css';

type Viewport = 'compare' | 'phone' | 'desktop';
const NARROW = '(max-width: 1440px)';
function subscribeWidth(onChange: () => void) {
    const media = window.matchMedia(NARROW);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
}
const getNarrow = () => window.matchMedia(NARROW).matches;
const getServerNarrow = () => true;

export function EmailDesignGallery({ samples, brandAssets }: { samples: EmailPreviewFamily[]; brandAssets: Readonly<Record<string, string>> }) {
    const [selectedId, setSelectedId] = useState(samples.some(sample => sample.id === 'owner-preview') ? 'owner-preview' : samples[0]?.id ?? '');
    const [variantId, setVariantId] = useState('default');
    const [chosenViewport, setViewport] = useState<Viewport | null>(null);
    const [query, setQuery] = useState('');
    const narrow = useSyncExternalStore(subscribeWidth, getNarrow, getServerNarrow);
    const viewport = chosenViewport ?? (narrow ? 'phone' : 'compare');
    const selected = samples.find(sample => sample.id === selectedId) ?? samples[0];
    const variant = selected?.variants.find(item => item.id === variantId) ?? selected?.variants[0];
    const categories = [...new Set(samples.map(sample => sample.category))];
    const filtered = samples.filter(sample => `${sample.label} ${sample.category} ${sample.description}`.toLowerCase().includes(query.toLowerCase().trim()));
    const select = (id: string) => { setSelectedId(id); setVariantId('default'); };
    if (!selected || !variant) return <main className={styles.empty}>No email samples available.</main>;
    const document = previewDocument(variant.html, brandAssets);
    const frame = (kind: 'phone' | 'desktop') => (
        <section className={`${styles.preview} ${kind === 'phone' ? styles.phone : styles.desktop}`} aria-label={`${kind === 'phone' ? 'Phone' : 'Desktop'} email preview`}>
            <div className={styles.previewBar}><span>{kind === 'phone' ? 'Phone' : 'Desktop'}</span><span>Sample inbox</span></div>
            <iframe key={`${selected.id}-${variant.id}-${kind}`} title={`${selected.label} — ${variant.label} — ${kind} preview`}
                srcDoc={document} sandbox="" referrerPolicy="no-referrer" className={styles.frame} />
        </section>
    );

    return (
        <main className={styles.root}>
            <header className={styles.header}>
                <div><p className={styles.eyebrow}>Tendso · Design review</p><h1>Tendso email designs</h1><p>{samples.length} email families, rendered from the actual templates.</p></div>
                <div className={styles.headerActions}><Link className={styles.proposalsLink} href="/design-review/emails/proposals">Approved direction ↗</Link><span className={styles.sampleBadge}>Sample · No email sent</span></div>
            </header>
            <div className={styles.workspace}>
                <aside className={styles.sidebar} aria-label="Email template selection">
                    <label className={styles.searchLabel} htmlFor="email-template-search">Find an email</label>
                    <input id="email-template-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search templates" className={styles.search} />
                    <div className={styles.mobileSelect}>
                        <label htmlFor="email-template-select">Template</label>
                        <select id="email-template-select" value={selected.id} onChange={event => select(event.target.value)}>
                            {categories.map(category => <optgroup key={category} label={category}>{samples.filter(sample => sample.category === category).map(sample => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</optgroup>)}
                        </select>
                    </div>
                    <nav className={styles.templateList} aria-label="Email families">
                        {categories.map(category => {
                            const entries = filtered.filter(sample => sample.category === category);
                            if (!entries.length) return null;
                            return <section key={category} className={styles.category} aria-label={category}>
                                <h2>{category}<span>{entries.length}</span></h2>
                                {entries.map(sample => <button key={sample.id} type="button" aria-current={selected.id === sample.id ? 'true' : undefined}
                                    onClick={() => select(sample.id)} className={styles.templateButton}>{sample.label}<span aria-hidden="true">{selected.id === sample.id ? '●' : '↗'}</span></button>)}
                            </section>;
                        })}
                        {!filtered.length ? <p className={styles.noResults} role="status">No matching templates.</p> : null}
                    </nav>
                </aside>

                <section className={styles.content} aria-labelledby="email-preview-title">
                    <div className={styles.intro}>
                        <div><p className={styles.eyebrow}>{selected.category}</p><h2 id="email-preview-title">{selected.label}</h2><p>{selected.description}</p></div>
                        <fieldset className={styles.viewports}><legend className={styles.srOnly}>Preview size</legend>
                            {(['phone', 'desktop', 'compare'] as const).map(size => <button key={size} type="button" aria-pressed={viewport === size} onClick={() => setViewport(size)}>{size === 'compare' ? 'Side by side' : size === 'phone' ? 'Phone' : 'Desktop'}</button>)}
                        </fieldset>
                    </div>
                    <div className={styles.messageHeader}>
                        <p><span>To</span>Alex Rivera · Sample recipient</p><p><span>Subject</span>{selected.subject}</p>
                        <p className={styles.renderer}><span>Template</span><code>{selected.renderer}</code></p>
                        {selected.variants.length > 1 ? <div className={styles.variant}>
                            <label htmlFor="email-preview-variant">State</label>
                            <select id="email-preview-variant" value={variant.id} onChange={event => setVariantId(event.target.value)}>{selected.variants.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                        </div> : null}
                    </div>
                    <p className={styles.note}>Fictional details only. Preview links and actions are disabled. Nothing is sent or changed.</p>
                    <div className={`${styles.canvas} ${viewport === 'compare' ? styles.comparison : ''}`}>
                        {viewport !== 'phone' ? frame('desktop') : null}
                        {viewport !== 'desktop' ? frame('phone') : null}
                    </div>
                </section>
            </div>
        </main>
    );
}
