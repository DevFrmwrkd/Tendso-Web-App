import { CAMPAIGN_CODES } from '../packages/shared/pricing';

export const CREATOR_CODE_MIN_LENGTH = 4;
export const CREATOR_CODE_MAX_LENGTH = 16;

export function normalizeCreatorCode(value: string): string {
    return value.trim().toUpperCase();
}

/** Shared input rules; availability and account ownership are always checked on the server. */
export function creatorCodeError(code: string): string | null {
    if (code.length < CREATOR_CODE_MIN_LENGTH || code.length > CREATOR_CODE_MAX_LENGTH) {
        return `Use a code between ${CREATOR_CODE_MIN_LENGTH} and ${CREATOR_CODE_MAX_LENGTH} characters.`;
    }
    if (!/^[A-Z0-9]+$/.test(code)) return 'Use letters and numbers only.';
    if (Object.prototype.hasOwnProperty.call(CAMPAIGN_CODES, code)) return 'That code is reserved. Choose another one.';
    return null;
}
