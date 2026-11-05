'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { visitError } from './visitPresentation';

const subscribeOnline = (listener: () => void) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('online', listener); window.addEventListener('offline', listener);
    return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};
const onlineSnapshot = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** One in-flight operation per mounted request; late work never updates another owner. */
export function useVisitOperation(isCurrentScope: () => boolean) {
    const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, () => true);
    const mounted = useRef(true), locked = useRef(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const current = () => mounted.current && isCurrentScope();
    const run = async <T,>(work: () => Promise<T>, success: (result: T) => void) => {
        if (!current() || locked.current || !onlineSnapshot()) return;
        locked.current = true; setBusy(true); setError(null);
        try {
            const result = await work();
            if (current() && onlineSnapshot()) success(result);
        } catch (cause) { if (current()) setError(visitError(cause)); }
        finally { locked.current = false; if (current()) setBusy(false); }
    };
    return { online, busy, error, setError, current, run };
}
