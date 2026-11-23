"use node";

import { SUPPORT_EMAIL } from "../../packages/shared/contact";
import { escapeHtml } from "../../lib/email/escape";

// Ported from the vonas-hr-pipeline repo, which owns the same tendso.hr Google
// account. Both apps write to the ONE calendar on purpose — that shared
// freebusy is what stops the two booking pages handing out the same slot.
//
// NOTE: `googleapis` is imported LAZILY inside the client factories below. A
// top-level import bundles the whole (very large) package into this module and
// Convex blows its 64 MB module-load limit (InvalidModules: "JavaScript
// execution ran out of memory") — the same failure convex/drive.ts hit. Do NOT
// hoist it back to a top-level import.

/**
 * The lazy import, with the CommonJS interop that makes it actually work.
 *
 * `googleapis` is CJS, so under Convex's bundler `await import("googleapis")`
 * can hand back a namespace whose `google` is undefined and whose real export
 * sits on `.default`. Destructuring straight to `{ google }` therefore fails at
 * the first property access with "Cannot read properties of undefined (reading
 * 'calendar')" — which reads exactly like a dead OAuth token and is not one.
 * Verified against the dev deployment, where it failed before this existed.
 */
async function loadGoogle() {
    // The lazy import erases googleapis' own types, and re-declaring its surface
    // here would be a worse lie than `any`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("googleapis"); // lazy — see the import note above
    const google = mod?.google ?? mod?.default?.google;
    if (!google) throw new Error("googleapis loaded but exposed no `google` export");
    return google;
}

/** Authenticated OAuth2 client for tendso.hr@gmail.com (Gmail + Calendar, full access). */
async function createTendsoOAuthClient() {
    const google = await loadGoogle();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.TENDSO_GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Tendso Google OAuth not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TENDSO_GOOGLE_REFRESH_TOKEN)"
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function createTendsoCalendarClient() {
  const auth = await createTendsoOAuthClient();
  const google = await loadGoogle();
  return google.calendar({ version: "v3", auth });
}

/**
 * Meet REST API, for conference durations.
 *
 * Read-only by scope. Note what this account can and cannot see: conference
 * records list that a conference ran and for how long, but `participants` comes
 * back empty, because attendance reports are a Workspace feature and this is a
 * consumer Gmail account. Verified against live data, not assumed.
 */
export async function createTendsoMeetClient() {
  const auth = await createTendsoOAuthClient();
  const google = await loadGoogle();
  return google.meet({ version: "v2", auth });
}

export async function createTendsoGmailClient() {
  const auth = await createTendsoOAuthClient();
  const google = await loadGoogle();
  return google.gmail({ version: "v1", auth });
}

/** Internal calendar identity, kept separate from the customer-facing sender. */
export const TENDSO_ADDRESS = "tendso.hr@gmail.com";
export const TENDSO_FROM = `Tendso <${SUPPORT_EMAIL}>`;

/**
 * Send booking confirmations and updates through the verified Support sender.
 * Calendar and Meet operations continue using the shared Google account above.
 * Failures propagate so the reminder caller can release its claim and retry.
 */
export async function sendAsTendso(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured for booking emails.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: TENDSO_FROM,
      to: [opts.to],
      reply_to: SUPPORT_EMAIL,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? escapeHtml(opts.text).replace(/\r?\n/g, "<br>"),
      ...(opts.inReplyTo ? {
        headers: { "In-Reply-To": opts.inReplyTo, References: opts.inReplyTo },
      } : {}),
    }),
  });
  if (!response.ok) throw new Error(`Booking email send failed (Resend ${response.status}).`);

  const result = await response.json() as { id?: unknown };
  if (typeof result.id !== "string" || !result.id) {
    throw new Error("Resend returned no booking email message id.");
  }
  return { id: result.id };
}
