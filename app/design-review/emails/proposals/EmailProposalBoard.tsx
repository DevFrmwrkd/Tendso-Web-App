'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Columns3, Monitor, Smartphone } from 'lucide-react';
import { V2Root } from '@/components/v2/V2Root';
import type { ProposalDirection, ProposalDirectionId, ProposalMessage, ProposalMessageId } from '@/lib/email/proposals';
import { previewDocument } from '../previewDocument';
import styles from './proposals.module.css';

type DirectionPreview = ProposalDirection & { examples: Array<{ messageId: ProposalMessageId; html: string }> };

export function EmailProposalBoard({ directions, messages, brandAssets }: { directions: DirectionPreview[]; messages: ProposalMessage[]; brandAssets: Record<string, string> }) {
    const [messageId, setMessageId] = useState<ProposalMessageId>('preview');
    const [focused, setFocused] = useState<ProposalDirectionId | null>('studio');
    const [size, setSize] = useState<'phone' | 'desktop'>('phone');
    const message = messages.find(item => item.id === messageId) ?? messages[0];
    const visible = focused ? directions.filter(direction => direction.id === focused) : directions;

    return <V2Root className={styles.page}>
        <header className={styles.topbar}>
            <Link className={styles.brand} href="/"><Image src="/v2/brand/mark-ink-256.png" width={28} height={28} alt="" /><span>tendso</span><span className={styles.brandDivider} /> <small>Design studio</small></Link>
            <Link className={styles.back} href="/design-review/emails"><ArrowLeft size={15} />Current templates</Link>
        </header>

        <main className={styles.main}>
            <section className={styles.intro}>
                <div><p className={styles.eyebrow}>Tendso · Website to inbox</p><h1>The website,<br />in your inbox.</h1></div>
                <div className={styles.introNote}><span className={styles.draft}>Proposals only</span><p>The same logo, type, lime buttons, rounded tiles, and friendly voice you see on Tendso.</p><p className={styles.quiet}>Fictional examples. Current email templates are unchanged.</p></div>
            </section>

            <section className={styles.recommendation} aria-label="Recommended direction">
                <span className={styles.recommendIcon}><Check size={19} /></span>
                <div><strong>Recommended: Tendso.</strong><p>Built from the website’s actual brand assets and design tokens. Compare the other treatments within the same family.</p></div>
            </section>

            <section className={styles.controls} aria-label="Compare email concepts">
                <div className={styles.messageControl}><label htmlFor="proposal-message">Choose a message</label><select id="proposal-message" value={messageId} onChange={event => setMessageId(event.target.value as ProposalMessageId)}>{messages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                <fieldset className={styles.directionControls}><legend>View</legend><div>
                    <button type="button" aria-pressed={focused === null} onClick={() => setFocused(null)}><Columns3 size={15} />Compare all</button>
                    {directions.map((direction, index) => <button key={direction.id} type="button" aria-pressed={focused === direction.id} onClick={() => setFocused(direction.id)}>{String(index + 1).padStart(2, '0')} {direction.name}</button>)}
                </div></fieldset>
                {focused ? <fieldset className={styles.sizes}><legend>Preview width</legend><div><button type="button" aria-label="Phone preview" aria-pressed={size === 'phone'} onClick={() => setSize('phone')}><Smartphone size={16} /></button><button type="button" aria-label="Desktop preview" aria-pressed={size === 'desktop'} onClick={() => setSize('desktop')}><Monitor size={16} /></button></div></fieldset> : null}
            </section>

            <div className={styles.context}><span><b>{message.label}</b> · {message.subject}</span><span>Sample only · Links disabled</span></div>

            <section className={`${styles.concepts} ${focused ? styles.focused : ''}`} aria-label="Proposed email designs">
                {visible.map(direction => {
                    const index = directions.findIndex(item => item.id === direction.id);
                    const html = direction.examples.find(example => example.messageId === messageId)?.html ?? '';
                    return <article key={direction.id} className={`${styles.concept} ${styles[direction.id]}`}>
                        <header className={styles.conceptHeader}>
                            <div className={styles.conceptTop}><span className={styles.number}>Direction {String(index + 1).padStart(2, '0')}</span>{direction.id === 'studio' ? <span className={styles.recommended}>Recommended</span> : null}</div>
                            <h2>{direction.name}</h2><p className={styles.kicker}>{direction.kicker}</p><p className={styles.description}>{direction.description}</p>
                            <div className={styles.for}><span>Best for</span><p>{direction.bestFor}</p></div>
                            {!focused ? <button type="button" className={styles.inspect} onClick={() => setFocused(direction.id)}>Inspect this direction <ArrowUpRight size={15} /></button> : null}
                        </header>
                        <div className={`${styles.previewWell} ${focused && size === 'desktop' ? styles.desktopWell : ''}`}>
                            {focused ? <aside className={styles.brandReference} aria-label="Website brand reference">
                                <p className={styles.referenceLabel}>From the website</p>
                                <div className={styles.referenceCard}>
                                    <div className={styles.referenceBrand}><Image src="/v2/brand/mark-ink-256.png" width={22} height={22} alt="" /><span>tendso</span></div>
                                    <Image src="/v2/brand/buddy-email.png" width={94} height={94} alt="Tendso mascot" className={styles.referenceBuddy} />
                                    <h3>The thinking<br />ends here.</h3>
                                    <span className={styles.referencePill}>Request an agent ↗</span>
                                </div>
                                <p className={styles.referenceCaption}>Official mark. Onest type.<br />Lime pills. Quiet, rounded tiles.</p>
                            </aside> : null}
                            <div className={`${styles.emailWindow} ${focused ? (size === 'desktop' ? styles.desktop : styles.phone) : ''}`}>
                                <div className={styles.inboxBar}><span><i /><i /><i /></span><span>tendso · inbox preview</span></div>
                                <iframe key={`${direction.id}-${messageId}`} title={`${direction.name} — ${message.label}`} srcDoc={previewDocument(html, brandAssets)} sandbox="" referrerPolicy="no-referrer" className={styles.emailFrame} />
                            </div>
                        </div>
                    </article>;
                })}
            </section>

            <footer className={styles.footer}><span>Official Tendso assets · Onest type · Lime pills · Rounded tiles</span><span>Tendso email concepts · November 2026</span></footer>
        </main>
    </V2Root>;
}
