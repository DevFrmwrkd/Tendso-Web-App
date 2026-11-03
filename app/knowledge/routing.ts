export type HelpSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/** Props are read on the server so help content does not wait for client hydration. */
export function helpViewParams(params: HelpSearchParams): { initialQuery: string; initialTopic: string } {
    return { initialQuery: first(params.q) ?? "", initialTopic: first(params.cat) || "all" };
}

/** Resolve public help links without treating supplied query values as redirect destinations. */
export function publicHelpDestination(params: HelpSearchParams): string | null {
    if (first(params.ws) === "wiki") return null;
    const article = first(params.article);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (key === "ws" || key === "article" || (article && key === "cat") || value === undefined) continue;
        for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
    }
    const suffix = query.size ? `?${query}` : "";
    if (article) return `/knowledge/${encodeURIComponent(article)}${suffix}`;
    return `/help${suffix}${first(params.cat) ? "#answers" : ""}`;
}
