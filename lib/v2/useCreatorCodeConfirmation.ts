"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Guard = { actor: string | null; code: string; context: string; allowed: boolean; busy: boolean };
type Choice = { actor: string; code: string; context: string; token: number };
const matches = (candidate: Choice, latest: Guard) => candidate.actor === latest.actor && candidate.code === latest.code && candidate.context === latest.context;

/** Confirm the exact reviewed choice once, against the latest committed form and actor. */
export function useCreatorCodeConfirmation({ actor, code, context, allowed, busy }: Guard) {
    const [choice, setChoice] = useState<Choice | null>(null);
    const current = useRef<Guard | null>({ actor, code, context, allowed, busy });
    const pending = useRef<Choice | null>(null);
    const writing = useRef<number | null>(null);
    const sequence = useRef(0);

    useLayoutEffect(() => {
        const latest = { actor, code, context, allowed, busy };
        current.current = latest;
        const candidate = pending.current;
        if (candidate && (!matches(candidate, latest) || !allowed && !busy)) {
            pending.current = null;
            setChoice(null);
        }
        return () => { current.current = null; };
    }, [actor, code, context, allowed, busy]);

    function request() {
        const latest = current.current;
        if (!latest?.actor || !latest.allowed || latest.busy || writing.current !== null) return;
        const next = { actor: latest.actor, code: latest.code, context: latest.context, token: ++sequence.current };
        pending.current = next;
        setChoice(next);
    }
    function cancel() {
        if (!current.current || current.current.busy || writing.current !== null) return;
        pending.current = null;
        setChoice(null);
    }
    function take(): Choice | null {
        const latest = current.current;
        const candidate = pending.current;
        // The closure's token also rejects a queued click from an older dialog.
        if (!choice || !candidate || candidate.token !== choice.token || !latest || !matches(candidate, latest) || !latest.allowed || latest.busy || writing.current !== null) return null;
        writing.current = candidate.token;
        return candidate;
    }
    function finish(token: number) {
        if (writing.current !== token) return;
        writing.current = null;
        if (pending.current?.token !== token) return;
        pending.current = null;
        if (current.current) setChoice(null);
    }
    const valid = !!choice && matches(choice, { actor, code, context, allowed, busy });
    return { open: valid, code: choice?.code ?? "", canConfirm: valid && allowed && !busy, request, cancel, take, finish };
}
