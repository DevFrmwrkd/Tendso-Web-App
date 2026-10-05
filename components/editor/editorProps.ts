import type { ReactNode } from "react";

import type { PreviewDevice } from "@/components/WebsitePreview";

/**
 * The props the website editor (SandboxEditorV3) takes.
 *
 * This interface used to live inside SandboxEditor.tsx - the 4,634-line v1 - and
 * v2, v3 and useEditorDraft all reached into that file for it with
 * `import type`. It moved here unchanged when v1 was retired.
 *
 * Round 1 changed the contract in ONE way, on purpose: the editor no longer
 * draws its own action toolbar. The board merges the old top action bar and the
 * editor toolbar into one workspace header with one primary action and a More
 * menu, and that header belongs to the page (it also shows before a site
 * exists, when there is no editor). So the page's actions (publish, send,
 * approve, reject, delete, give free…) left this interface, and two slots came
 * in: `renderHeader`, which the editor calls with its own controls (save,
 * undo/redo, preview size…) so the page can place them in that header, and
 * `aside`, the details panel docked beside the preview. Nothing about how
 * content is read, edited, drafted or saved changed.
 */

/**
 * The site's content and customisations are free-form JSON: their shape is per
 * template, and only genericContentSchema knows it. Typed loosely on purpose,
 * here, once.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EditorJson = any;

/** What the editor hands the page's header. */
export interface EditorTools {
    /** Unsaved changes exist (content or design). */
    dirty: boolean;
    saving: boolean;
    /** Save once: one rebuild, and a republish when the site is live. */
    save: () => void;
    /** Throw away every unsaved change. */
    discard: () => void;
    /** Build the unsaved draft into a real page, persisting nothing (~30–60s). */
    previewUnsaved: () => void;
    previewing: boolean;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    device: PreviewDevice;
    setDevice: (device: PreviewDevice) => void;
    /** A save or a rebuild is running; anything that rebuilds waits for it. */
    busy: boolean;
}

export interface SandboxEditorProps {
    submissionId: string;
    businessName: string;
    businessType?: string;
    htmlContent: string;
    /** True while the stored HTML is still being fetched for the preview. */
    htmlLoading?: boolean;
    content: EditorJson;
    customizations: EditorJson;
    photos: string[];
    /**
     * AI-enhanced image URLs resolved by the parent page (Convex storage
     * IDs already converted to https URLs via api.files.getMultipleUrls).
     * The Image-picker modal's "AI-enhanced" tab reads from this list.
     */
    enhancedImageUrls?: string[];

    onSaveContent: (content: EditorJson, customizationsOverride?: EditorJson) => Promise<void>;

    /**
     * The address the public sees. The page withholds it while the site is
     * offline, so nothing in the editor links visitors at a holding page.
     */
    websitePublishedUrl?: string;
    websiteGenerated: boolean;
    generatingWebsite: boolean;

    /** The workspace header, drawn by the page around the editor's controls. */
    renderHeader?: (tools: EditorTools) => ReactNode;
    /** Docked to the right of the preview: the details panel on a wide screen. */
    aside?: ReactNode;
}
