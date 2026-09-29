/**
 * The props every website editor takes.
 *
 * This interface used to live inside SandboxEditor.tsx - the 4,634-line v1 - and
 * v2, v3 and useEditorDraft all reached into that file for it with
 * `import type`. That import is erased at compile time, so it was never a
 * runtime dependency; it was just the last thing keeping a retired editor in
 * the tree.
 *
 * Moved here UNCHANGED, so retiring v1 cannot quietly alter the contract v3 is
 * built against.
 */

export interface SandboxEditorProps {
    submissionId: string;
    businessName: string;
    businessType?: string;
    htmlContent: string;
    content: any;
    customizations: any;
    photos: string[];
    /**
     * AI-enhanced image URLs resolved by the parent page (Convex storage
     * IDs already converted to https URLs via api.files.getMultipleUrls).
     * The Image-picker modal's "AI-enhanced" tab reads from this list.
     */
    enhancedImageUrls?: string[];

    onSaveContent: (content: any, customizationsOverride?: any) => Promise<void>;
    onUpdateDesign: (customizations: any) => Promise<void>;

    websitePublishedUrl?: string;
    websiteGenerated: boolean;
    generatingWebsite: boolean;
    publishingWebsite: boolean;
    republishingWebsite: boolean;
    unpublishingWebsite: boolean;
    enhancing: boolean;
    sendingEmail: boolean;

    onSendToClient: () => void;
    onEnhanceImages: () => void;
    onRegenerate: () => void;
    onPublish: () => void;
    onRepublish: () => void;
    onUnpublish: () => void;
    onDelete: () => void;
    onApprove?: () => void;
    onReject?: () => void;
    submissionStatus?: string;

    /**
     * PROMO — give the site to the owner for free; the creator is still paid.
     *
     * Needed on an editor toolbar as well as TopActionBar because the page hides
     * TopActionBar entirely while the editor is open on a generated site
     * (app/admin/submissions/[id]/page.tsx). Without it the action is
     * unreachable from where the admin actually finishes a website — and worse,
     * "Send to client", which bills the owner, is the only settlement button in
     * view.
     *
     * RENDERED BY V3 ONLY, by decision. These props live on the shared type
     * because all three editors take it, but v1 and v2 deliberately ignore
     * them: the promo runs out of v3, and adding a money action to two older
     * surfaces means three places to keep the eligibility rule in sync.
     */
    onGiveFree?: () => void;
    markingComped?: boolean;
    /** ₱1,499 tier — comping it would charge us a registrar fee, so the button hides. */
    isCustomDomainTier?: boolean;
    /** Already given away; one giveaway per site. */
    isComped?: boolean;

    onToggleDetails?: () => void;
    detailsOpen?: boolean;
}
