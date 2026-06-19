/**
 * Where an authenticated creator should be routed based on their lifecycle
 * state. Single source of truth so every gated page redirects consistently.
 *
 * State priority (mutually exclusive at any moment):
 *   rejected (rejectedAt)                          → /verification-rejected
 *   passed quiz, not yet approved (quizPassedAt && !certifiedAt) → /pending
 *   hasn't passed the quiz                         → /training
 *   approved (certifiedAt) or admin                → null (allow through)
 *
 * Returns the path to redirect to, or null if the creator may stay.
 * Pass the creator row from api.creators.getByClerkId.
 */
export interface CreatorGateInput {
    role?: string;
    certifiedAt?: number;
    quizPassedAt?: number;
    rejectedAt?: number;
}

export function creatorRedirect(creator: CreatorGateInput | null | undefined): string | null {
    if (!creator) return null; // not loaded / no profile — caller handles separately
    if (creator.role === "admin" || creator.certifiedAt) return null; // allowed
    if (creator.rejectedAt) return "/verification-rejected";
    if (creator.quizPassedAt) return "/pending";
    return "/training";
}
