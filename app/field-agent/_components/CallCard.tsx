'use client';

import { AlertCircle, ArrowUpRight, Clock, Globe, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { Status, cx, type StatusWord } from './BookingUI';

export function CallFacts({ className }: { className?: string }) {
    const facts = [{ Icon: Clock, title: 'A quick conversation', text: '10 minutes' }, { Icon: Monitor, title: 'Join from anywhere', text: 'Google Meet, link sent by email' }, { Icon: Globe, title: 'One time zone', text: 'Philippine time (GMT+8)' }];
    return <ul className={cx('bk-facts', className)}>{facts.map(({ Icon, title, text }) => <li key={title}><span className="bk-fact-icon"><Icon size={18} aria-hidden="true" /></span><div><strong>{title}</strong><span>{text}</span></div></li>)}</ul>;
}
export function PickedTime({ label, time, day, compact = false }: { label: string; time?: string | null; day?: string | null; compact?: boolean }) {
    return <div className={cx('bk-picked', compact && 'bk-picked--compact')}><span className="bk-label">{label}</span>{time ? <><strong>{time}</strong>{day ? <span className="bk-meta">{day}</span> : null}</> : <span className="bk-meta">Pick a day, then a time.</span>}</div>;
}
export function ActionBar({ children }: { children: ReactNode }) { return <div className="bk-action-bar">{children}</div>; }
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
    return <div role="alert" className={cx('bk-notice', className)}><AlertCircle size={20} aria-hidden="true" /><p>{children}</p></div>;
}
function Fact({ term, children }: { term: string; children: ReactNode }) { return <div className="bk-ticket-fact"><dt>{term}</dt><dd>{children}</dd></div>; }
export function CallTicket({ status, time, day, meetUrl, name, email, children }: { status: StatusWord; time: string; day: string; meetUrl: string | null; name: string; email: string; children?: ReactNode }) {
    return <article className="bk-ticket" aria-label="Your booking">
        <div className="bk-ticket-top"><div className="bk-ticket-cap"><span className="bk-label">Your Tendso call</span><Status {...status} /></div>
            <p className="bk-ticket-time">{time}</p><p className="bk-ticket-day">{day}</p><span className="bk-ticket-zone"><Globe size={14} aria-hidden="true" />Philippine time · GMT+8</span></div>
        <div className="bk-ticket-tear" aria-hidden="true" />
        <dl className="bk-ticket-details"><Fact term="Length">10 minutes</Fact><Fact term="Name">{name}</Fact><Fact term="Where">Google Meet{meetUrl ? <a href={meetUrl} target="_blank" rel="noopener noreferrer" className="bk-meet-link">Open meeting<ArrowUpRight size={14} aria-hidden="true" /></a> : <span className="bk-meta">Link sent by email</span>}</Fact><Fact term="Invite sent to">{email}</Fact></dl>
        {children ? <div className="bk-ticket-bottom">{children}</div> : null}
    </article>;
}
