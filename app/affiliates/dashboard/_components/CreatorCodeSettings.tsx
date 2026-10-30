"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button, Field, Input } from "@/components/r1";
import type { Doc } from "@/convex/_generated/dataModel";
import { CREATOR_CODE_MAX_LENGTH, creatorCodeError, normalizeCreatorCode } from "@/lib/creatorCodes";
import { CODE_PERCENT_OFF } from "@/lib/v2/creatorProgram";
import { errorMessage, useCreatorCodeAvailability, useDebounced, useUpdateCreatorCode } from "@/lib/v2/creatorData";

type Props = { account: Doc<"creators">; preview?: boolean };

/** Preview and suspended views never mount code lookups or the update mutation hook. */
export function CreatorCodeSettings({ account, preview = false }: Props) {
    if (preview || account.isDeleted || account.role !== "affiliate" || account.status !== "active") return <ReadOnlyCode account={account} preview={preview} />;
    return <LiveCreatorCode key={`${account.clerkId}:${account._id}:${account.status}`} account={account} />;
}

function ReadOnlyCode({ account, preview }: Props) {
    return <section className="ap-code-settings t-card t-card-pad flex min-w-0 flex-col gap-4" aria-label="Creator code">
        <div className="flex flex-col gap-2"><h2 className="t-h2">Your creator code</h2><p className="t-meta">Every creator code gives shop owners {CODE_PERCENT_OFF}% off.</p></div>
        <Field label="Your creator code"><Input value={account.referralCode ?? ""} disabled readOnly placeholder="No creator code" /></Field>
        <p className="t-meta">{preview ? "Code changes are disabled in this preview." : account.status === "suspended" ? "Code changes are paused while your account is suspended." : "Code changes are unavailable for this account."}</p>
        <Button disabled>Save code</Button>
    </section>;
}

function LiveCreatorCode({ account }: { account: Doc<"creators"> }) {
    const { user, isLoaded, isSignedIn } = useUser();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const editable = isLoaded && isSignedIn && isAuthenticated && !isLoading && user?.id === account.clerkId;
    const savedCode = normalizeCreatorCode(account.referralCode ?? "");
    const [code, setCode] = useState(savedCode);
    const [seenCode, setSeenCode] = useState(savedCode);
    const [success, setSuccess] = useState<{ code: string; before: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const dirty = code !== savedCode;
    // An account refresh confirms a successful save; unrelated updates preserve a new draft.
    if (seenCode !== savedCode) {
        setSeenCode(savedCode);
        if (code === seenCode || savedCode === success?.code) setCode(savedCode);
    }
    const problem = dirty ? creatorCodeError(code) : null;
    const debounced = useDebounced(code);
    const requested = editable && dirty && !problem && debounced === code ? code : null;
    const check = useCreatorCodeAvailability(requested);
    const updateCode = useUpdateCreatorCode();
    const exact = requested === code && check.status === "checked" && check.result?.value === code;
    const available = exact && check.result?.available === true;
    const waitingForRefresh = success?.code === code && savedCode !== code && savedCode === success?.before;
    const canSave = editable && dirty && !problem && available && !saving && !waitingForRefresh;
    const actor = editable ? `${user.id}:${account._id}` : null;
    const currentActor = useRef(actor);
    const statusId = useId();
    useEffect(() => {
        currentActor.current = actor;
        return () => { currentActor.current = null; };
    }, [actor]);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSave || !actor) return;
        setSaving(true);
        setSaveError(null);
        try {
            const result = await updateCode(code);
            if (currentActor.current === actor) setSuccess({ code: result.code, before: savedCode });
        } catch (error) {
            if (currentActor.current === actor) {
                setSaveError(errorMessage(error, "Could not save your code. Try again."));
                check.retry();
            }
        } finally {
            if (currentActor.current === actor) setSaving(false);
        }
    }

    const status = !editable ? "Sign in to change your code."
        : waitingForRefresh ? "Code saved. Updating your saved page…"
        : success?.code === code && !dirty ? "Code saved."
        : !dirty ? "This is your saved code."
        : problem ? ""
        : check.status === "error" ? check.error
        : available ? "This code is available."
        : exact ? check.result?.error ?? "That code is already taken. Choose another one."
        : "Checking code availability…";
    return <section className="ap-code-settings t-card t-card-pad flex min-w-0 flex-col gap-4" aria-label="Creator code">
        <div className="flex flex-col gap-2"><h2 className="t-h2">Your creator code</h2><p className="t-meta">Choose a code people can remember, like MIKA30. Every code gives {CODE_PERCENT_OFF}% off.</p></div>
        <form className="flex min-w-0 flex-col gap-4" onSubmit={save} noValidate>
            <Field label="Your creator code" help="Use 4–16 letters or numbers." error={problem ?? undefined}>
                <Input value={code} maxLength={CREATOR_CODE_MAX_LENGTH} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={!editable || saving || waitingForRefresh} onChange={event => {
                    setCode(normalizeCreatorCode(event.target.value));
                    setSaveError(null);
                    setSuccess(null);
                }} />
            </Field>
            <p id={statusId} className={check.status === "error" || exact && !available ? "t-error" : "t-meta"} role="status" aria-live="polite">{status}</p>
            {check.status === "error" && dirty && !problem ? <Button size="sm" onClick={check.retry} disabled={!editable || saving}>Check again</Button> : null}
            {saveError ? <p className="t-error" role="alert">{saveError}</p> : null}
            <div className="ap-save-row flex flex-wrap items-center gap-3"><Button type="submit" variant="primary" disabled={!canSave} aria-busy={saving}>{saving ? "Saving…" : "Save code"}</Button></div>
        </form>
        <p className="t-meta">Previous codes keep working. Your page, QR code and poster use the saved code after you save.</p>
    </section>;
}
