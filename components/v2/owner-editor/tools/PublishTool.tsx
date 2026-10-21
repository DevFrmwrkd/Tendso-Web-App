"use client";

import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/v2";
import { ToolScreen } from "../ui";
import type { OwnerEditorModel } from "../useOwnerEditor";

const hostOf = (url: string) => { try { return new URL(url).host; } catch { return url; } };

/** "Publish changes": one button, and an honest answer about what it does. */
export function PublishTool({ model }: { model: OwnerEditorModel }) {
    const { site, publishState: s } = model;
    const live = site.live;

    if (s.phase === "working") {
        return (
            <ToolScreen title="Publishing">
                <div className="flex flex-col items-center gap-4 py-10 text-center" role="status">
                    <Loader2 size={40} className="animate-spin" />
                    <p className="text-[20px] font-medium">Building your site.</p>
                    <p className="text-[16px] text-v2-ink-2">This takes about a minute.</p>
                </div>
            </ToolScreen>
        );
    }

    if (s.phase === "done") {
        const r = s.result;
        const line = r.pendingWorker
            ? "Saved. Tendso will put it on your own web address today."
            : r.republished
                ? "Your site is updated."
                : "Saved. Your site goes live when you pay.";
        return (
            <ToolScreen
                title="Done"
                onBack={() => { model.resetPublish(); model.setTool(null); }}
                footer={
                    <div className="flex flex-col gap-2">
                        {r.publishedUrl && r.live && (
                            <Button href={r.publishedUrl} target="_blank" rel="noreferrer" size="lg" block><ExternalLink size={20} /> See my site</Button>
                        )}
                        <Button variant="ghost" block onClick={() => { model.resetPublish(); model.setTool(null); }}>Keep editing</Button>
                    </div>
                }
            >
                <p className="text-[22px] font-medium leading-snug">{line}</p>
            </ToolScreen>
        );
    }

    return (
        <ToolScreen
            title="Publish changes"
            hint={live ? undefined : "Your site is a private preview until you pay."}
            onBack={() => { model.resetPublish(); model.setTool(null); }}
            footer={
                <Button block size="lg" disabled={!model.hasChanges} onClick={() => void model.publish()}>
                    {live ? "Publish changes" : "Save changes"}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                {s.phase === "error" && <p role="alert" className="rounded-v2-card bg-[#FDECEA] p-4 text-[18px] font-medium text-[#8C1D18]">{s.message}</p>}
                {!model.hasChanges ? (
                    <p className="text-[20px] font-medium leading-snug">Nothing new to publish.</p>
                ) : live && site.publishedUrl ? (
                    <p className="text-[20px] font-medium leading-snug">Updates {hostOf(site.publishedUrl)}</p>
                ) : (
                    <p className="text-[20px] font-medium leading-snug">Your changes are kept safe.</p>
                )}
            </div>
        </ToolScreen>
    );
}
