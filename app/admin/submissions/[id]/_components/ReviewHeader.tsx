"use client";

import { ArrowLeft, Redo2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button, ButtonLink, Icon, MoreMenu, Segmented, Status, submissionStatus, type MenuItem } from "@/components/r1";
import type { EditorTools } from "@/components/editor/editorProps";
import { PREVIEW_DEVICE_OPTIONS } from "@/components/WebsitePreview";

/**
 * The one workspace header (board Review). It replaces two bars: the old top
 * action bar and the editor's own toolbar ("merged into one header with one
 * primary action and a More menu").
 *
 * Left: the way back, the business, the one question this screen answers, its
 * status. Right: where the work stands (saved, live or not), the editor's
 * undo/redo and preview size while there is a site to edit, the Details toggle,
 * then exactly one primary action and the More menu with everything else.
 *
 * Phone first: the title row takes the whole first line and the actions wrap
 * under it, right-aligned so the More menu always opens on screen. Narrower
 * desks drop the question under the title and move the preview size next to
 * the preview, so the business name keeps room.
 */
export function ReviewHeader({
    businessName,
    status,
    saveState,
    tools,
    details,
    primary,
    moreItems,
}: {
    businessName: string;
    status: string;
    /** "Saved", "Unsaved changes", "Changes not live yet"… */
    saveState?: ReactNode;
    /** The editor's own controls, while the site is being edited. */
    tools?: EditorTools;
    details?: { open: boolean; onToggle: () => void };
    /** The one primary action (or the one secondary that stands in for it). */
    primary?: ReactNode;
    /** Hidden when empty (the board hides More while a site is generating). */
    moreItems?: MenuItem[];
}) {
    const word = submissionStatus(status, "admin");
    return (
        <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-r1-line bg-r1-paper px-3 py-2.5 lg:h-16 lg:flex-nowrap lg:py-0 lg:pl-3 lg:pr-4">
            <div className="flex min-w-0 basis-full items-center gap-3 lg:flex-1 lg:basis-0">
                <ButtonLink variant="ghost" href="/admin/submissions" className="flex-none px-2.5" aria-label="Back to submissions">
                    <Icon icon={ArrowLeft} />
                    <span className="hidden sm:inline">Submissions</span>
                </ButtonLink>
                <span className="hidden h-7 w-px flex-none bg-r1-line sm:block" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h1 className="truncate font-r1-serif text-[22px] font-normal leading-7 tracking-[-0.01em] text-r1-ink sm:text-2xl">{businessName}</h1>
                    <p className="hidden truncate text-[13px] leading-4 text-r1-ink-3 min-[1440px]:block">Is this site ready to go live?</p>
                    <Status {...word} className="min-[1440px]:hidden" />
                </div>
                <Status {...word} className="hidden flex-none min-[1440px]:inline-flex" />
            </div>

            <div className="flex min-w-0 basis-full flex-wrap items-center justify-end gap-2 lg:flex-none lg:basis-auto lg:flex-nowrap">
                {saveState}
                {tools && (
                    <>
                        <Button
                            variant="ghost"
                            icon
                            onClick={tools.undo}
                            disabled={!tools.canUndo}
                            aria-label={tools.canUndo ? "Undo" : "Undo (nothing to undo)"}
                            title={tools.canUndo ? "Undo (Ctrl/Cmd+Z)" : "Nothing to undo"}
                        >
                            <Icon icon={Undo2} />
                        </Button>
                        <Button
                            variant="ghost"
                            icon
                            onClick={tools.redo}
                            disabled={!tools.canRedo}
                            aria-label={tools.canRedo ? "Redo" : "Redo (nothing to redo)"}
                            title={tools.canRedo ? "Redo (Ctrl/Cmd+Shift+Z)" : "Nothing to redo"}
                        >
                            <Icon icon={Redo2} />
                        </Button>
                        <Segmented
                            label="Preview size"
                            options={PREVIEW_DEVICE_OPTIONS}
                            value={tools.device}
                            onChange={tools.setDevice}
                            className="hidden xl:inline-flex"
                        />
                    </>
                )}
                {details && (
                    <Button aria-pressed={details.open} onClick={details.onToggle} className="aria-pressed:border-r1-ink aria-pressed:bg-r1-fill-nav">
                        Details
                    </Button>
                )}
                {primary}
                {moreItems && moreItems.length > 0 && (
                    <MoreMenu label={`More actions for ${businessName}`} items={moreItems} className="[&>.t-menu]:min-w-[260px]" />
                )}
            </div>
        </header>
    );
}
