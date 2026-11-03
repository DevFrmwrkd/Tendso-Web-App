/** Auth may return only to the owner's workspace or a complete payment link. */
export function ownerReturnPath(value: string | null | undefined): string {
    return value && ((/^\/my-business(?:\/[A-Za-z0-9_-]+)?$/.test(value) && value !== '/my-business/sign-in')
        || /^\/(?:v2\/)?pay\/[a-fA-F0-9]{64}$/.test(value))
        ? value : '/my-business';
}
