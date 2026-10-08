/** Field creators include legacy rows without a role. Other account types do not. */
export function isCreatorAccount(account: { role?: string } | null | undefined): boolean {
    return !!account && (account.role === undefined || account.role === 'creator');
}
