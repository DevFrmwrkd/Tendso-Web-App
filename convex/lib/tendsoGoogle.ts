"use node";

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

export async function createTendsoGmailClient() {
  const auth = await createTendsoOAuthClient();
  const google = await loadGoogle();
  return google.gmail({ version: "v1", auth });
}

export const TENDSO_ADDRESS = "tendso.hr@gmail.com";
export const TENDSO_FROM = `Tendso HR Team <${TENDSO_ADDRESS}>`;

/** RFC 2047 encoded-word, so names like "Tuñacao" survive in a Subject. */
function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/**
 * Send mail as tendso.hr@gmail.com through the Gmail API.
 *
 * Used for everything after a candidate is in the pipeline (booking
 * confirmations, call reminders), so replies land in the tendso.hr inbox
 * where the agent reads them. First-touch outreach still goes out via
 * Resend from hr@vonas-media.com — different mailbox, different purpose.
 *
 * Note: unlike Resend there is no bounce webhook here, so bounces are not
 * fed back into the bounced_emails table. The pre-send bounce check still
 * applies; only new bounce discovery is lost.
 */
export async function sendAsTendso(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
}) {
  const gmail = await createTendsoGmailClient();
  const boundary = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const html = opts.html ?? opts.text.replace(/\n/g, "<br>");

  const headers = [
    `From: ${TENDSO_FROM}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    ...(opts.inReplyTo
      ? [`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`]
      : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${boundary}--`,
    "",
  ];

  const raw = Buffer.from([...headers, "", ...body].join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return res.data;
}
