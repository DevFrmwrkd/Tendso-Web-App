const OWNER_PATH = /^\/my-business(?:\/[A-Za-z0-9_-]+|\/(?:visits|drafts)\/[A-Za-z0-9_-]+)?$/;

/** Only owned workspace routes and their known deep-link parameters may survive sign-in. */
export function ownerReturnPath(value: string | null | undefined): string {
    const fallback = '/my-business';
    if (!value || /[\s\\\u0000-\u001f\u007f]/.test(value) || value.includes('#')) return fallback;
    if (/^\/(?:v2\/)?pay\/[a-fA-F0-9]{64}$/.test(value)) return value;
    if (!value.startsWith('/') || value.startsWith('//')) return fallback;
    try {
        const url = new URL(value, 'https://owner.tendso.invalid');
        if (url.origin !== 'https://owner.tendso.invalid' || !OWNER_PATH.test(url.pathname) || url.pathname === '/my-business/sign-in'
            || value.split('?')[0].split('/').some(part => /^\.{1,2}$/.test(decodeURIComponent(part)))) return fallback;
        const allowed = url.pathname === '/my-business/notifications' ? 'eventKey'
            : url.pathname === '/my-business/visits/new' ? 'submissionId' : null;
        const keys = [...url.searchParams.keys()];
        if (keys.length) {
            if (!allowed || keys.length !== 1 || keys[0] !== allowed) return fallback;
            const parameter = url.searchParams.get(allowed) ?? '';
            if (!(allowed === 'eventKey' ? /^[A-Za-z0-9:._-]{1,512}$/ : /^[A-Za-z0-9_-]{1,100}$/).test(parameter)) return fallback;
        }
        return url.pathname + url.search;
    } catch { return fallback; }
}
