import { BASE_PRICE, PRICE_CEILING, formatPHP } from './pricing';

export const AFFILIATE_HANDLE_MIN_LENGTH = 3;
export const AFFILIATE_HANDLE_MAX_LENGTH = 30;

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

/** Reject invalid quotes rather than silently charging a different price. */
export function affiliatePriceError(price: number): string | null {
    return Number.isInteger(price) && price >= BASE_PRICE && price <= PRICE_CEILING
        ? null
        : `Set a whole-peso price from ${formatPHP(BASE_PRICE)} to ${formatPHP(PRICE_CEILING)}.`;
}
