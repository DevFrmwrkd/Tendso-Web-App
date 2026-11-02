/** Defaults for generation, before explicit saved/editor customizations win. */
export function generationFontDefaults(
    heroStyle: string,
    customizations: { fontPairing?: string; fontPairingId?: string } = {},
): { fontPairing: string; fontPairingId: string } {
    const fallback = heroStyle.startsWith('business:') ? 'auto' : 'modern';
    // Either historical key is an explicit selection. Populate the other alias
    // with it so a default cannot mask the selection in the Astro transform.
    return {
        fontPairing: customizations.fontPairing || customizations.fontPairingId || fallback,
        fontPairingId: customizations.fontPairingId || customizations.fontPairing || fallback,
    };
}
