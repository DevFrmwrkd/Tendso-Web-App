// Keep capture validation safe to share between Convex, web, and native clients.
// The general security module starts a rate-limiter timer when imported.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

export function normalizeCaptureEmail(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function captureEmailError(value: unknown): string | null {
    const email = normalizeCaptureEmail(value);
    if (!email) return 'Enter the owner’s email address.';
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
        return 'Enter a valid email address for the owner.';
    }
    return null;
}
