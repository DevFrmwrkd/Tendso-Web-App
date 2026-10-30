"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { Component, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button, Field, Input } from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";
import { CREATOR_CODE_MAX_LENGTH, creatorCodeError, normalizeCreatorCode } from "@/lib/creatorCodes";
import { CODE_PERCENT_OFF } from "@/lib/v2/creatorProgram";
import { CREATORS_SAMPLE, errorMessage, useCreatorCodeAvailability, useCreatorCodeSetup, useDebounced, useUpdateCreatorCode } from "@/lib/v2/creatorData";

type Props = { account: Doc<"creators">; preview?: boolean };
const CODE_ALREADY_SET = "Your creator code is already set and cannot be changed.";

/** Only the server can decide whether this account still has its one-time choice. */
export function CreatorCodeSettings({ account, preview = false }: Props) {
    if (preview || CREATORS_SAMPLE || account.isDeleted || account.role !== "affiliate" || account.status !== "active") return <ReadOnlyCode account={account} preview={preview || CREATORS_SAMPLE} />;
    return <VerifiedCreatorCode key={`${account.clerkId}:${account._id}:${account.status}`} account={account} />;
}

function ReadOnlyCode({ account, preview, code = account.referralCode, message, retry }: Props & { code?: string | null; message?: string; retry?: () => void }) {
    return <section className="ap-code-settings t-card t-card-pad flex min-w-0 flex-col gap-4" aria-label="Creator code">
        <div className="flex flex-col gap-2"><h2 className="t-h2">Your creator code</h2><p className="t-meta">Every creator code gives shop owners {CODE_PERCENT_OFF}% off.</p></div>
        <Field label="Your creator code"><Input value={code ?? ""} disabled readOnly placeholder="No creator code" /></Field>
        <p className={retry ? "t-error" : "t-meta"} role={retry ? "alert" : "status"}>{message ?? (preview ? "Code setup is disabled in this preview." : account.status === "suspended" ? "Code setup is unavailable while your account is suspended." : "Code setup is unavailable for this account.")}</p>
        {retry ? <Button onClick={retry}>Retry</Button> : null}
    </section>;
}

function VerifiedCreatorCode({ account }: { account: Doc<"creators"> }) {
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const editable = isLoaded && isSignedIn && isAuthenticated && !isLoading && user?.id === account.clerkId;
    if (!editable) return <ReadOnlyCode account={account} message="Sign in to view your code setup." />;
    return <CodeSetupBoundary account={account}><CreatorCodeSetupReader account={account} /></CodeSetupBoundary>;
}

class CodeSetupBoundary extends Component<{ account: Doc<"creators">; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <ReadOnlyCode account={this.props.account} message="Could not load your code setup. Try again." retry={() => this.setState({ failed: false })} /> : this.props.children;
    }
}

function CreatorCodeSetupReader({ account }: { account: Doc<"creators"> }) {
    const setup = useCreatorCodeSetup(true);
    const [confirmed, setConfirmed] = useState<string | null>(null);
    const [lockedError, setLockedError] = useState<string | null>(null);
    if (confirmed) return <ReadOnlyCode account={account} code={confirmed} message="This is your permanent creator code. It cannot be changed." />;
    if (!setup || setup.creatorId !== account._id) return <ReadOnlyCode account={account} message="Loading your code setup…" />;
    if (!setup.canChoose || lockedError) return <ReadOnlyCode account={account} code={setup.code} message={lockedError ?? "This is your permanent creator code. It cannot be changed."} />;
    return <LiveCreatorCode account={account} initialCode={setup.code} onChosen={setConfirmed} onLocked={setLockedError} />;
}

function LiveCreatorCode({ account, initialCode, onChosen, onLocked }: { account: Doc<"creators">; initialCode: string | null; onChosen: (code: string) => void; onLocked: (message: string) => void }) {
    const savedCode = normalizeCreatorCode(initialCode ?? "");
    const [code, setCode] = useState(savedCode);
    const [seenCode, setSeenCode] = useState(savedCode);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    // A fresh setup result updates a clean draft while preserving a new candidate.
    if (seenCode !== savedCode) {
        setSeenCode(savedCode);
        if (code === seenCode) setCode(savedCode);
    }
    const problem = creatorCodeError(code);
    const debounced = useDebounced(code);
    const requested = !problem && debounced === code ? code : null;
    const check = useCreatorCodeAvailability(requested);
    const updateCode = useUpdateCreatorCode();
    const exact = requested === code && check.status === "checked" && check.result?.value === code;
    const available = exact && check.result?.available === true;
    const canSave = !problem && available && !saving;
    const actor = `${account.clerkId}:${account._id}`;
    const currentActor = useRef<string | null>(actor);
    const statusId = useId();
    useEffect(() => {
        currentActor.current = actor;
        return () => { currentActor.current = null; };
    }, [actor]);
    useEffect(() => {
        if (exact && check.result?.error === CODE_ALREADY_SET) onLocked(CODE_ALREADY_SET);
    }, [exact, check.result?.error, onLocked]);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSave || !actor) return;
        setSaving(true);
        setSaveError(null);
        try {
            const result = await updateCode(code);
            if (currentActor.current === actor) onChosen(result.code);
        } catch (error) {
            if (currentActor.current === actor) {
                const message = errorMessage(error, "Could not set your code. Try again.");
                if (message === CODE_ALREADY_SET) onLocked(message);
                else { setSaveError(message); check.retry(); }
            }
        } finally {
            if (currentActor.current === actor) setSaving(false);
        }
    }

    const status = problem ? ""
        : check.status === "error" ? check.error
        : available ? "This code is available."
        : exact ? check.result?.error ?? "That code is already taken. Choose another one."
        : "Checking code availability…";
    return <section className="ap-code-settings t-card t-card-pad flex min-w-0 flex-col gap-4" aria-label="Creator code">
        <div className="flex flex-col gap-2"><h2 className="t-h2">Choose your creator code</h2><p className="t-meta">Choose a code people can remember, like MIKA30. Every code gives {CODE_PERCENT_OFF}% off.</p><p className="t-body font-semibold">Choose carefully. You cannot change this code later.</p></div>
        <form className="flex min-w-0 flex-col gap-4" onSubmit={save} noValidate>
            <Field label="Your creator code" help="Use 4–16 letters or numbers." error={problem ?? undefined}>
                <Input value={code} maxLength={CREATOR_CODE_MAX_LENGTH} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={saving} onChange={event => {
                    setCode(normalizeCreatorCode(event.target.value));
                    setSaveError(null);
                }} />
            </Field>
            <p id={statusId} className={check.status === "error" || exact && !available ? "t-error" : "t-meta"} role="status" aria-live="polite">{status}</p>
            {check.status === "error" && !problem ? <Button size="sm" onClick={check.retry} disabled={saving}>Check again</Button> : null}
            {saveError ? <p className="t-error" role="alert">{saveError}</p> : null}
            <div className="ap-save-row flex flex-wrap items-center gap-3"><Button type="submit" variant="primary" disabled={!canSave} aria-busy={saving}>{saving ? "Setting code…" : "Set my code"}</Button></div>
        </form>
        <p className="t-meta">Your page, QR code and poster use your chosen code after setup.</p>
    </section>;
}
