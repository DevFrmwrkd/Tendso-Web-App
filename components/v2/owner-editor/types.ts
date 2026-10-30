/**
 * The contract between the owner editor's screens and where the site lives.
 * Convex backs it for real owners (ConvexOwnerEditor); the dev-only sample
 * page backs it with local state so the editor can be seen without a sign-in.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export interface OwnerSite {
    submissionId: string;
    businessName: string;
    businessType: string;
    /** On the web now (published and not taken down). */
    live: boolean;
    publishedUrl: string | null;
    /** The page as it is built today. Empty until the first build. */
    html: string;
    /** The site's own content and design: what "Undo everything" returns to. */
    base: { content: Json; customizations: Json };
    /** What the editor opens with: the owner's saved draft, else the site. */
    saved: { content: Json; customizations: Json };
    /** Their own photos from the interview, and Tendso's polished versions. */
    photos: string[];
    polished: string[];
}

export interface PublishResult {
    live: boolean;
    republished: boolean;
    pendingWorker: boolean;
    publishedUrl: string | null;
    html?: string;
}

export interface OwnerEditorActions {
    /** Keep the working copy on the server. Never changes the live site. */
    saveDraft(content: Json, customizations: Json): Promise<void>;
    /** Upload a photo; resolves to its https address. */
    uploadPhoto(file: File): Promise<string>;
    /** The exact page for a design with their saved draft, not stored (about a minute). */
    buildPreview(templateCode: string | null): Promise<string>;
    /** Build the saved draft for real; for a live site this is the new live page. */
    publish(): Promise<PublishResult>;
    /** Forget the working copy. */
    discard(): Promise<void>;
}

export type ToolId = 'design' | 'font' | 'colours' | 'text' | 'photos' | 'sections' | 'publish';
