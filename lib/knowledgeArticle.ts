export function knowledgeSlugError(slug: string): string | undefined {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return "Use lowercase letters and numbers, with hyphens between words."
    }
}

export function parseKnowledgeKeywords(text: string): string[] {
    const seen = new Set<string>()
    return text.split(/[,\n]/).map((keyword) => keyword.trim()).filter((keyword) => {
        const key = keyword.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

/** Article media is an explicit HTTPS URL, never an executable or local URI. */
export function knowledgeImageUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null
    const candidate = value.trim()
    try {
        const url = new URL(candidate)
        return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? candidate : null
    } catch { return null }
}
