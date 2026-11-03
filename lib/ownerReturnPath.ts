/** An owner invitation may return only to the owner's workspace. */
export function ownerReturnPath(value: string | null | undefined): string {
    return value && /^\/my-business(?:\/[A-Za-z0-9_-]+)?$/.test(value) && value !== '/my-business/sign-in'
        ? value : '/my-business';
}
