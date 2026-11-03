export type LoginReturnPath = "/dashboard" | "/knowledge?ws=wiki";

/** Only this specific public, access-checked wiki destination bypasses role routing. */
export function loginReturnPath(value: string | string[] | undefined): LoginReturnPath {
    const requested = Array.isArray(value) ? value[0] : value;
    return requested === "/knowledge?ws=wiki" ? requested : "/dashboard";
}
