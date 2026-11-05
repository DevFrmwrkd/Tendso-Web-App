"use client";

import { LayoutTemplate, Loader2, Monitor, PencilLine, Image as ImageIcon, Palette, Rows3, Smartphone, Type, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/v2";
import { cx } from "@/components/v2/cx";
import { PreviewFrame, type Device } from "./PreviewFrame";
import { ColourTool } from "./tools/ColourTool";
import { DesignTool } from "./tools/DesignTool";
import { FontTool } from "./tools/FontTool";
import { PhotosTool } from "./tools/PhotosTool";
import { PublishTool } from "./tools/PublishTool";
import { SectionsTool } from "./tools/SectionsTool";
import { TextTool } from "./tools/TextTool";
import type { OwnerEditorActions, OwnerSite, ToolId } from "./types";
import { useOwnerEditor, type OwnerEditorModel } from "./useOwnerEditor";

const ACTIONS: Array<{ id: ToolId; label: string; icon: typeof Type }> = [
    { id: "design", label: "Change design", icon: LayoutTemplate },
    { id: "font", label: "Font", icon: Type },
    { id: "colours", label: "Colours", icon: Palette },
    { id: "text", label: "Edit text", icon: PencilLine },
    { id: "photos", label: "Photos", icon: ImageIcon },
    { id: "sections", label: "Sections", icon: Rows3 },
];

/**
 * /v2/my-site: the owner's live preview with six big actions and one
 * "Publish changes". Everything the owner can touch is the admin editor's own
 * schema, rendering and save path (see useOwnerEditor); this file is the shell.
 */
export function OwnerSiteEditor({ site, actions, backHref = "/my-business" }: { site: OwnerSite; actions: OwnerEditorActions; backHref?: string }) {
    const model = useOwnerEditor(site, actions);
    // A phone-sized screen starts on the phone view of the site. (The editor only
    // ever mounts in the browser, after the site has loaded.)
    const [device, setDevice] = useState<Device>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches ? "phone" : "computer"));

    const hasPage = !!model.pageHtml || model.waitingForDesign;
    // While the page is being built for real, nothing may change underneath it.
    const working = model.publishState.phase === "working";

    return (
        <div className="flex h-dvh min-h-0 flex-col bg-v2-stage text-v2-ink" data-testid="owner-editor">
            {working && <div className="fixed inset-0 z-40 cursor-wait bg-white/40" aria-hidden />}
            <Header model={model} backHref={backHref} />
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <section className="relative min-h-0 flex-1 px-3 pb-2 pt-1 lg:p-5 lg:pr-0">
                    <div className="relative h-full overflow-hidden rounded-[22px] bg-[#E7E8E4]">
                        {hasPage ? <PreviewFrame model={model} device={device} /> : <NotBuilt />}
                        <DeviceToggle device={device} onChange={setDevice} />
                        {model.waitingForDesign && <Making model={model} />}
                    </div>
                </section>
                <aside className={cx(
                    "relative z-50 flex min-h-0 flex-none flex-col bg-v2-canvas lg:m-5 lg:w-[440px] lg:rounded-[28px] lg:shadow-v2-object",
                    model.tool ? "h-[58dvh] rounded-t-[28px] lg:h-auto" : "rounded-t-[28px] lg:h-auto lg:rounded-[28px]",
                )}>
                    {model.tool ? <ToolView model={model} /> : <Home model={model} />}
                </aside>
            </div>
        </div>
    );
}

function Header({ model, backHref }: { model: OwnerEditorModel; backHref: string }) {
    const { site, saveState, hasChanges } = model;
    return (
        <header className="flex flex-none items-center gap-3 px-4 py-3 lg:px-6">
            <Link href={backHref} className="inline-flex h-11 items-center rounded-full px-3 text-[16px] font-medium text-v2-ink-2 hover:bg-white" aria-label="Back to my site">←<span className="ml-1 hidden sm:inline">My site</span></Link>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-medium leading-tight">{site.businessName}</p>
                <p className="truncate text-[16px] leading-tight text-v2-ink-2" aria-live="polite">
                    {saveState === "saving" ? "Saving…" : saveState === "error" ? "Could not save. Check your connection." : hasChanges ? "Not published" : site.live ? "Live" : "Private preview"}
                </p>
            </div>
            <button
                type="button"
                aria-label="Undo"
                onClick={() => model.m.undo()}
                disabled={!model.m.canUndo}
                className="hidden h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-v2-ink disabled:opacity-30 sm:inline-flex"
            >
                <Undo2 size={20} />
            </button>
            <Button size="md" disabled={!hasChanges} onClick={() => model.openTool("publish")}>
                Publish changes
            </Button>
        </header>
    );
}

function Home({ model }: { model: OwnerEditorModel }) {
    return (
        <div className="p-4 lg:p-6">
            <h2 className="mb-3 hidden text-[24px] font-medium tracking-[-0.03em] lg:block">What do you want to change?</h2>
            <ul className="grid grid-cols-3 gap-2.5 lg:grid-cols-2 lg:gap-3">
                {ACTIONS.map((a) => (
                    <li key={a.id}>
                        <button
                            type="button"
                            onClick={() => model.openTool(a.id)}
                            className="flex min-h-[92px] w-full flex-col items-start justify-between gap-2 rounded-v2-card bg-v2-stage p-3.5 text-left transition-colors hover:bg-[#E7E8E4] lg:min-h-[116px] lg:p-5"
                        >
                            <a.icon size={26} strokeWidth={1.75} />
                            <span className="text-[17px] font-medium leading-tight lg:text-[19px]">{a.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ToolView({ model }: { model: OwnerEditorModel }) {
    switch (model.tool) {
        case "design": return <DesignTool model={model} />;
        case "font": return <FontTool model={model} />;
        case "colours": return <ColourTool model={model} />;
        case "text": return <TextTool model={model} />;
        case "photos": return <PhotosTool model={model} />;
        case "sections": return <SectionsTool model={model} />;
        case "publish": return <PublishTool model={model} />;
        default: return null;
    }
}

function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
    return (
        <div className="absolute bottom-3 right-3 flex rounded-full bg-white p-1 shadow-v2-object" role="group" aria-label="Preview size">
            {([["phone", Smartphone, "Phone"], ["computer", Monitor, "Computer"]] as const).map(([id, Icon, label]) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={device === id}
                    aria-label={label}
                    onClick={() => onChange(id)}
                    className={cx("inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors", device === id ? "bg-v2-ink text-white" : "text-v2-ink-2 hover:bg-v2-stage")}
                >
                    <Icon size={20} />
                </button>
            ))}
        </div>
    );
}

function Making({ model }: { model: OwnerEditorModel }) {
    if (model.designError) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 p-4 backdrop-blur-[2px]" role="alert">
                <div className="flex max-w-[320px] flex-col items-center gap-3 rounded-[26px] bg-white p-6 text-center shadow-v2-object">
                    <p className="text-[20px] font-medium leading-tight">We could not make this design.</p>
                    <Button block onClick={() => model.retryDesign(model.code)}>Try again</Button>
                    <Button block variant="ghost" onClick={() => model.chooseDesign(model.baseCode)}>Go back to mine</Button>
                </div>
            </div>
        );
    }
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]" role="status">
            <div className="flex max-w-[300px] flex-col items-center gap-3 rounded-[26px] bg-white p-6 text-center shadow-v2-object">
                <Loader2 size={34} className="animate-spin" />
                <p className="text-[20px] font-medium leading-tight">Making your page in this design.</p>
                <p className="text-[16px] text-v2-ink-2">About a minute.</p>
            </div>
        </div>
    );
}

function NotBuilt() {
    return (
        <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="max-w-[320px] text-[20px] font-medium leading-snug">Your site is not built yet. We will tell you when it is ready.</p>
        </div>
    );
}
