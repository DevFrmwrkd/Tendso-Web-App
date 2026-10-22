"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OwnerSiteEditor } from "./OwnerSiteEditor";
import type { Json, OwnerEditorActions, OwnerSite, PublishResult } from "./types";

const messageOf = (err: unknown, fallback: string) => {
    if (err instanceof ConvexError && typeof err.data === "string") return err.data;
    return err instanceof Error && err.message && !/^\[CONVEX|Server Error/i.test(err.message) ? err.message : fallback;
};

/** The owner editor for one real site: Convex for the draft and photos, /api/owner-site for builds. */
export function ConvexOwnerEditor({ submissionId }: { submissionId: string }) {
    const id = submissionId as Id<"submissions">;
    const state = useQuery(api.ownerSiteEdits.getEditorState, { submissionId: id });
    const save = useMutation(api.ownerSiteEdits.saveDraft);
    const discard = useMutation(api.ownerSiteEdits.discardDraft);
    const uploadUrl = useAction(api.ownerSiteEdits.generateUploadUrl);
    const register = useMutation(api.ownerSiteEdits.registerUpload);

    // The built page, fetched once.
    const [html, setHtml] = useState<string | null>(null);
    const fetched = useRef(false);
    useEffect(() => {
        if (!state || fetched.current) return;
        if (state.htmlInline) { fetched.current = true; setHtml(state.htmlInline); return; }
        if (!state.htmlUrl) { fetched.current = true; setHtml(""); return; }
        fetched.current = true;
        fetch(state.htmlUrl).then((r) => (r.ok ? r.text() : "")).then(setHtml).catch(() => setHtml(""));
    }, [state]);

    const actions = useMemo<OwnerEditorActions>(() => {
        const build = async (body: Record<string, unknown>) => {
            const res = await fetch("/api/owner-site", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId, ...body }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "We could not build your site. Nothing was changed.");
            return data;
        };
        return {
            async saveDraft(content: Json, customizations: Json) {
                try { await save({ submissionId: id, content, customizations }); }
                catch (err) { throw new Error(messageOf(err, "Could not save.")); }
            },
            async discard() { await discard({ submissionId: id }); },
            async uploadPhoto(file: File) {
                try {
                    const url = await uploadUrl({ submissionId: id });
                    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
                    if (!res.ok) throw new Error("That photo did not upload. Please try again.");
                    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
                    const done = await register({ submissionId: id, storageId });
                    if (!done.ok) throw new Error(done.message);
                    return done.url;
                } catch (err) {
                    throw new Error(messageOf(err, "That photo did not upload. Please try again."));
                }
            },
            async buildPreview(templateCode: string | null) {
                const data = await build({ mode: "preview", ...(templateCode ? { template: templateCode } : {}) });
                return String(data.html ?? "");
            },
            async publish(): Promise<PublishResult> {
                const data = await build({ mode: "publish" });
                return { live: !!data.live, republished: !!data.republished, pendingWorker: !!data.pendingWorker, publishedUrl: data.publishedUrl ?? null, html: data.html };
            },
        };
    }, [id, submissionId, save, discard, uploadUrl, register]);

    const initial = useRef<OwnerSite | null>(null);
    if (!state || html === null) return <Loading />;

    const site: OwnerSite = {
        submissionId,
        businessName: state.businessName,
        businessType: state.businessType,
        live: state.live,
        publishedUrl: state.publishedUrl,
        html,
        base: state.base,
        saved: state.draft ? { content: state.draft.content, customizations: state.draft.customizations } : state.base,
        photos: state.photos,
        polished: state.polished,
    };
    // The editor opens on its first copy and keeps its own working state; only
    // the facts that change on the server (live, address, photos) follow.
    initial.current ??= site;
    return <OwnerSiteEditor key={submissionId} site={{ ...site, html: initial.current.html, saved: initial.current.saved }} actions={actions} />;
}

function Loading() {
    return (
        <div className="flex h-dvh items-center justify-center bg-v2-stage" role="status">
            <p className="text-[20px] font-medium text-v2-ink-2">Opening your site…</p>
        </div>
    );
}
