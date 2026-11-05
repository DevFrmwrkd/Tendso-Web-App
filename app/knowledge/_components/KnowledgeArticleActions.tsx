"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/v2";
import { api } from "@/convex/_generated/api";
import { SUPPORT_EMAIL } from "@/lib/contact";

import { pushRecent } from "./recent";

export function KnowledgeArticleActions({ slug }: { slug: string }) {
    const record = useMutation(api.knowledge.recordFeedback);
    const [answer, setAnswer] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => { pushRecent(slug); }, [slug]);

    async function send(helpful: boolean) {
        if (saving || answer !== null) return;
        setSaving(true);
        setError("");
        try {
            await record({ slug, helpful });
            setAnswer(helpful);
        } catch {
            setError("Your feedback could not be saved. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return <section className="kh-feedback v2-tile v2-tile--quiet" aria-live="polite">
        {answer === null ? <><div><h2>Did this answer your question?</h2>{error && <p role="alert">{error}</p>}</div><div className="kh-actions">
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void send(true)}>Yes</Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void send(false)}>Not yet</Button>
        </div></> : answer ? <p>Thanks for letting us know.</p> : <><div><h2>Let’s get you an answer.</h2><p>Tell our team what you need help with.</p></div><Button href={`mailto:${SUPPORT_EMAIL}`} size="sm">Ask a person</Button></>}
    </section>;
}
