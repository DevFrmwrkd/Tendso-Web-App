export const AFFILIATE_HANDLE_MIN_LENGTH = 3;
export const AFFILIATE_HANDLE_MAX_LENGTH = 30;
export const AFFILIATE_MESSAGE_MAX_LENGTH = 200;

export const AFFILIATE_SOCIAL_PLATFORMS = ['messenger', 'facebook', 'instagram', 'tiktok', 'youtube'] as const;
export type AffiliateSocialPlatform = typeof AFFILIATE_SOCIAL_PLATFORMS[number];
export type AffiliateSocialLinks = Partial<Record<AffiliateSocialPlatform, string>>;
export const AFFILIATE_SOCIAL_LABELS: Record<AffiliateSocialPlatform, string> = {
    messenger: 'Messenger', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
};

const SOCIAL_HOSTS: Record<AffiliateSocialPlatform, readonly string[]> = {
    messenger: ['messenger.com', 'm.me'], facebook: ['facebook.com'], instagram: ['instagram.com'],
    tiktok: ['tiktok.com'], youtube: ['youtube.com', 'youtu.be'],
};

/** Reserved routes and Tendso identities cannot become an affiliate address. */
export const AFFILIATE_RESERVED_HANDLES = [
    '100-pages-giveaway', 'about', 'admin', 'affiliate', 'affiliates', 'api', 'app',
    'auth', 'billing', 'blog', 'certification', 'certification-quiz', 'change-password',
    'connect-ai', 'contact', 'creators', 'dashboard', 'earnings', 'edit-profile',
    'faq', 'field-agent', 'for-creators', 'for-field-agents', 'forgot-password',
    'help', 'help-faq', 'home', 'join', 'knowledge', 'leads', 'legal', 'login',
    'logout', 'my-business', 'new', 'notifications', 'onboarding', 'otr', 'pay',
    'payment', 'pending', 'pending-review', 'preview', 'pricing', 'privacy',
    'privacy-policy', 'profile', 'referrals', 'reset-password', 'settings', 'signin',
    'sign-in', 'signup', 'sign-up', 'start', 'static', 'submissions', 'submit',
    'support', 'system', 'tendso', 'terms', 'terms-of-service', 'training',
    'training-lessons', 'verification-rejected', 'wallet', 'website', 'www',
] as const;

export function affiliateHandleError(handle: string): string | null {
    if (handle.length < AFFILIATE_HANDLE_MIN_LENGTH || handle.length > AFFILIATE_HANDLE_MAX_LENGTH) {
        return 'Use a page handle between 3 and 30 characters.';
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) {
        return 'Use lowercase letters, numbers, and hyphens between words.';
    }
    if ((AFFILIATE_RESERVED_HANDLES as readonly string[]).includes(handle)) {
        return 'That page handle is reserved. Choose another one.';
    }
    return null;
}

export function affiliatePhoneError(phone: string): string | null {
    return /^(\+63|0)?9\d{9}$/.test(phone)
        ? null
        : 'Enter a Philippine mobile number, like 09171234567.';
}

/** Finite editor input is rounded and clamped by updatePage before saving. */
export function affiliatePriceError(price: number): string | null {
    return Number.isFinite(price) ? null : 'Enter a valid price.';
}

function httpsUrlError(value: string, label: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 2048) return `${label} must be 2048 characters or fewer.`;
    try {
        const url = new URL(trimmed);
        if (url.protocol === 'https:' && !url.username && !url.password) return null;
    } catch {
        // Invalid URL syntax uses the same actionable message as an unsafe URL.
    }
    return `${label} must be a valid HTTPS URL.`;
}

export function affiliatePhotoError(value: string): string | null {
    return httpsUrlError(value, 'Photo');
}

/** Match a platform domain, never a lookalike suffix or a credential-bearing URL. */
function socialPlatformForLink(value: string): AffiliateSocialPlatform | null {
    if (!value.trim() || httpsUrlError(value, 'Social link')) return null;
    const url = new URL(value.trim());
    if (url.port) return null;
    return AFFILIATE_SOCIAL_PLATFORMS.find((platform) => SOCIAL_HOSTS[platform].some((domain) =>
        url.hostname === domain || (domain !== 'm.me' && domain !== 'youtu.be' && url.hostname.endsWith(`.${domain}`)),
    )) ?? null;
}

/** An empty input removes this platform from the public creator page. */
export function affiliateSocialPlatformLinkError(platform: AffiliateSocialPlatform, value: string): string | null {
    const label = AFFILIATE_SOCIAL_LABELS[platform];
    const urlError = httpsUrlError(value, `${label} link`);
    if (urlError) return urlError;
    if (!value.trim()) return null;
    return socialPlatformForLink(value) === platform ? null : `Use a ${label} link starting with https://.`;
}

/** Legacy single-link clients may still save any supported public social URL. */
export function affiliateSocialLinkError(value: string): string | null {
    const urlError = httpsUrlError(value, 'Social link');
    if (urlError || !value.trim()) return urlError;
    return socialPlatformForLink(value) ? null : 'Use a Messenger, Facebook, Instagram, TikTok, or YouTube link starting with https://.';
}

/** A saved map is authoritative, including {}. Old accounts fall back to their single saved link. */
export function getAffiliateSocialLinks(links?: AffiliateSocialLinks, legacy?: string): AffiliateSocialLinks {
    if (links !== undefined) {
        return Object.fromEntries(AFFILIATE_SOCIAL_PLATFORMS.flatMap((platform) => {
            const value = links[platform]?.trim();
            return value && !affiliateSocialPlatformLinkError(platform, value) ? [[platform, value]] : [];
        }));
    }
    const platform = legacy ? socialPlatformForLink(legacy) : null;
    return platform && legacy ? { [platform]: legacy.trim() } : {};
}
