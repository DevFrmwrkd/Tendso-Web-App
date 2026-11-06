'use client';

import { ArrowLeft, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { V2Root } from '@/components/v2/V2Root';
import './booking.css';

/** One current Tendso frame for booking, confirmation and private manage links. */
export default function BookingShell({ title, steps, current = 0, phoneBar = false, children }: {
    title: ReactNode; steps?: string[]; current?: number; phoneBar?: boolean; children: ReactNode;
}) {
    return <V2Root className={`booking${phoneBar ? ' booking--with-action' : ''}`}>
        <header className="bk-topbar"><div className="bk-topbar-in">
            <Link href="/" aria-label="Tendso home" className="bk-brand"><Image src="/v2/brand/mark-ink-256.png" alt="" width={30} height={30} /><span>tendso</span></Link>
            <Link href="/for-field-agents" className="bk-exit"><ArrowLeft size={16} aria-hidden="true" /><span>Back to site</span></Link>
        </div></header>
        <main className="bk-main">
            <header className="bk-page-head">
                <div className="bk-page-titles"><p className="bk-eyebrow">Let’s talk · Field agents</p><h1>{title}</h1>
                    <p className="bk-page-sub">A short conversation. A clear next step.</p></div>
                {steps ? <nav aria-label="Booking progress" className="bk-stepper"><ol>
                    {steps.map((label, index) => <li key={label} data-state={index < current ? 'done' : index === current ? 'current' : 'next'} aria-current={index === current ? 'step' : undefined}>
                        <span className="bk-step-number" aria-hidden="true">{index < current ? <Check size={15} strokeWidth={2.4} /> : String(index + 1).padStart(2, '0')}</span>
                        <span>{label}</span>
                    </li>)}
                </ol></nav> : null}
            </header>
            {children}
            <footer className="bk-footer">10 minutes · Google Meet · Philippine time</footer>
        </main>
    </V2Root>;
}
