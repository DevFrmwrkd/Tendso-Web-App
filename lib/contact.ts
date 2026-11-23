/**
 * How people reach Tendso. One place, so the footer, the Help Center's contact
 * card and the error state never disagree.
 */
export { SUPPORT_EMAIL } from "../packages/shared/contact";
/** The registered company behind Tendso. */
export const OPERATOR = "VONAS, OPC";
/**
 * The field-agent Discord server, where new creators get onboarded and coached.
 * NEXT_PUBLIC_DISCORD_INVITE_URL overrides it in any environment; the default
 * is the live server.
 */
export const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "https://discord.gg/Dxjt9HV5B";
