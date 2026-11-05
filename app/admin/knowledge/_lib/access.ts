import type { KnowledgeAudience, KnowledgeVisibility } from "@/packages/shared/knowledge"

export type KnowledgeAccess = { audiences: KnowledgeAudience[]; visibility: KnowledgeVisibility }

export const AUDIENCE_LABEL: Record<KnowledgeAudience, string> = {
    everyone: "Everyone",
    owner: "Business owners",
    affiliate: "Affiliates",
    field_agent: "Field agents",
    admin: "Admins",
}

export const ACCESS_LABEL: Record<KnowledgeVisibility, string> = {
    public: "Public",
    authenticated: "Signed-in accounts",
    internal: "Internal",
}

/** Everyone is an alternative to individual audiences, never an extra tag. */
export function toggleAudience(current: KnowledgeAudience[], audience: KnowledgeAudience): KnowledgeAudience[] {
    if (audience === "everyone") return ["everyone"]
    const specific = current.filter((item) => item !== "everyone")
    const next = specific.includes(audience) ? specific.filter((item) => item !== audience) : [...specific, audience]
    // The final selection stays explicit; an empty selection must not broaden access.
    return next.length > 0 ? next : current
}

export function accessSummary(access: KnowledgeAccess): string {
    return `${ACCESS_LABEL[access.visibility]} · ${access.audiences.map((audience) => AUDIENCE_LABEL[audience]).join(", ")}`
}
