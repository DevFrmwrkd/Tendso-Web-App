'use client';

import { AlertCircle, CalendarX, LoaderCircle, X, type LucideIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useId, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Button as V2Button } from '@/components/v2/Button';
import { bookingStatus, type StatusWord } from '@/components/r1/statusWords';

// Reuse status semantics; these pages supply their own V2 presentation.
export { bookingStatus, type StatusWord };
export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ');
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Shared = { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean; className?: string; children: ReactNode };
const buttonVariant = (variant: Variant) => variant === 'primary' ? 'primary' as const : 'ghost' as const;

export function Button({ variant = 'secondary', className, ...props }: Shared & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
    return <V2Button {...props} variant={buttonVariant(variant)} className={cx('bk-button', variant === 'danger' && 'bk-button--danger', className)} />;
}
export function ButtonLink({ variant = 'secondary', className, ...props }: Shared & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>) {
    return <V2Button {...props} variant={buttonVariant(variant)} className={cx('bk-button', variant === 'danger' && 'bk-button--danger', className)} />;
}
export function Icon({ icon: Glyph, size = 18, className }: { icon: LucideIcon; size?: number; className?: string }) {
    return <Glyph size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
type FieldState = { id: string; messageId?: string; invalid: boolean; required: boolean };
const FieldContext = createContext<FieldState | null>(null);
export function Field({ label, required = false, help, error, children }: { label: ReactNode; required?: boolean; help?: ReactNode; error?: ReactNode; children: ReactNode }) {
    const id = useId();
    const message = error || help;
    return <FieldContext.Provider value={{ id, messageId: message ? `${id}-message` : undefined, invalid: !!error, required }}>
        <div className="bk-field"><label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>{children}
            {message ? <p id={`${id}-message`} className={error ? 'bk-error' : 'bk-help'}>{message}</p> : null}</div>
    </FieldContext.Provider>;
}
export function Input(props: ComponentPropsWithRef<'input'>) {
    const field = useContext(FieldContext);
    return <input {...props} id={props.id ?? field?.id} required={props.required ?? field?.required}
        aria-describedby={props['aria-describedby'] ?? field?.messageId} aria-invalid={props['aria-invalid'] ?? (field?.invalid || undefined)} className={cx('bk-input', props.className)} />;
}
export function Status({ tone, word }: Partial<StatusWord>) { return <span className="bk-status" data-tone={tone}>{word}</span>; }
export function Skeleton({ width, height = 18, className }: { width?: number | string; height?: number | string; className?: string }) {
    return <span aria-hidden="true" className={cx('bk-skeleton', className)} style={{ width, height }} />;
}
export function Loading({ label, className, children }: { label: string; className?: string; children?: ReactNode }) {
    return <div role="status" aria-label={label} className={className}><span className="sr-only">{label}</span>{children ?? <div className="bk-state"><LoaderCircle size={24} className="bk-spin" aria-hidden="true" /><p>{label}</p></div>}</div>;
}
export function EmptyState({ title, body, icon, className }: { title: string; body?: string; icon?: ReactNode; className?: string }) {
    return <div className={cx('bk-state', className)}><span className="bk-state-icon">{icon ?? <CalendarX size={23} aria-hidden="true" />}</span><h2>{title}</h2>{body ? <p>{body}</p> : null}</div>;
}
export function ErrorState({ what, onRetry, className }: { what: string; onRetry: () => void; className?: string }) {
    return <div className={cx('bk-state', className)} role="alert"><span className="bk-state-icon"><AlertCircle size={23} aria-hidden="true" /></span><h2>We couldn’t load {what.toLowerCase()}.</h2><p>Try again to see the latest available times.</p><Button onClick={onRetry}>Try again</Button></div>;
}

/** The browser’s modal dialog provides focus containment and restoration. No action runs on open. */
export function ConfirmDialog({ open, onCancel, onConfirm, busy = false, title, confirmLabel, children }: {
    open: boolean; onCancel: () => void; onConfirm: () => void; busy?: boolean; title: string; confirmLabel: string; children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !open) return;
        const previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        dialog.showModal();
        return () => { dialog.close(); document.documentElement.style.overflow = previousOverflow; };
    }, [open]);
    return <dialog ref={ref} className="bk-dialog" aria-labelledby={titleId} aria-busy={busy}
        onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
        onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
        <div className="bk-dialog-body"><button className="bk-dialog-close" type="button" onClick={onCancel} disabled={busy} aria-label="Close cancellation confirmation"><X size={19} aria-hidden="true" /></button>
            <span className="bk-state-icon"><CalendarX size={23} aria-hidden="true" /></span><h2 id={titleId}>{title}</h2><div className="bk-dialog-copy">{children}</div>
            <div className="bk-dialog-actions"><Button onClick={onCancel} disabled={busy}>Keep my call</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button></div>
        </div>
    </dialog>;
}
