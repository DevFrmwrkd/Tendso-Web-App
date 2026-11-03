/**
 * ALL owner data access for the app, as typed hooks. Screens never call Convex
 * directly — swap the backend here and nothing else changes.
 *
 * Backend: contract docs/v2-api-owners.md, called through the generated `api`.
 * Screens use the plain types in ./ownerTypes (the backend's return shapes are
 * checked against them here).
 *
 * Sample mode: EXPO_PUBLIC_OWNER_SAMPLE_DATA=1 runs the whole owner path on
 * typed sample data (./ownerSample) — for demos, screenshots and before the
 * backend is deployed. Never on in production builds.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@tendso/convex-client';
import { SITE_URL } from '../../services/links';
import { sample } from './ownerSample';
import { ownerPaymentOrigin } from './ownerPaymentOrigin';
import type {
  BuildState,
  CheckoutResult,
  CreateDraftArgs,
  EnsureResult,
  NearbyAgent,
  OwnerMe,
  OwnerSubmission,
  OwnerCreatorCodeState,
  OwnerCreatorOffer,
  PayKind,
  PaymentState,
  PayToken,
  OwnerPaymentAttempt,
  OwnerPaymentRetry,
  PreviewState,
  SaveAnswerArgs,
  SaveShotArgs,
  SubmissionId,
  UpdateDraftArgs,
  VisitRequest,
} from './ownerTypes';

import { OWNER_SAMPLE_DATA } from './ownerFlags';

export { OWNER_SAMPLE_DATA };

/** Where template previews and the web pay page live. */
export const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_ORIGIN || SITE_URL).replace(/\/$/, '');

type Sid = { submissionId: SubmissionId };

// ------------------------------------------------------------------ references
// docs/v2-api-owners.md: owners.* (convex/owners.ts), ownerApp.* (convex/ownerApp.ts),
// ownerPayments.* (convex/ownerPayments.ts), xendit.createCheckout (convex/xendit.ts).
const ref = {
  ensure: api.owners.ensure,
  me: api.owners.me,
  createDraft: api.ownerApp.createDraft,
  updateDraft: api.ownerApp.updateDraft,
  saveAnswer: api.ownerApp.saveAnswer,
  saveShot: api.ownerApp.saveShot,
  removeShot: api.ownerApp.removeShot,
  chooseDesign: api.ownerApp.chooseDesign,
  submit: api.ownerApp.submit,
  approvePreview: api.ownerApp.approvePreview,
  requestChange: api.ownerApp.requestChange,
  getSubmission: api.ownerApp.getSubmission,
  getBuild: api.ownerApp.getBuild,
  getPreview: api.ownerApp.getPreview,
  paymentState: api.ownerPayments.getPaymentState,
  createPayToken: api.ownerPayments.createPayToken,
  createCheckout: api.xendit.createCheckout,
  paymentAttempt: api.ownerPayments.getPaymentAttempt,
  retryPayment: api.ownerPayments.retryExpiredPayment,
};

/** Re-render on sample store changes (sample mode only). */
function useSample<T>(select: () => T): T {
  return useSyncExternalStore(sample.subscribe, select, select);
}

const skip = 'skip' as const;

// ------------------------------------------------------------------ account

/** The signed-in owner and their sites. undefined = loading, null = not an owner yet (call ensure). */
export function useOwnerMe(enabled = true): OwnerMe | null | undefined {
  if (OWNER_SAMPLE_DATA) return useSample(() => sample.me()); // eslint-disable-line react-hooks/rules-of-hooks
  const { userId } = useAuth(); // eslint-disable-line react-hooks/rules-of-hooks
  return useQuery(ref.me, enabled && userId ? { clerkId: userId } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

/** Create / re-link the owner row after every sign-in. Idempotent. */
export function useEnsureOwner(): (args?: { name?: string; phone?: string }) => Promise<EnsureResult> {
  const m = useMutation(ref.ensure);
  const { userId } = useAuth();
  return useCallback((args = {}) => {
    if (OWNER_SAMPLE_DATA) return sample.ensure(args);
    if (!userId) return Promise.reject(new Error('Please sign in again.'));
    return m({ ...args, clerkId: userId });
  }, [m, userId]);
}

// ------------------------------------------------------------------ draft

export function useOwnerSubmission(id: SubmissionId | null | undefined): OwnerSubmission | undefined {
  if (OWNER_SAMPLE_DATA) return useSample(() => (id ? sample.submission(id) : undefined)); // eslint-disable-line react-hooks/rules-of-hooks
  return useQuery(ref.getSubmission, id ? { submissionId: id } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

export function useCreateDraft(): (args: CreateDraftArgs) => Promise<SubmissionId> {
  const m = useMutation(ref.createDraft);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.createDraft(args) : m(args)), [m]);
}

export function useUpdateDraft(): (args: UpdateDraftArgs) => Promise<unknown> {
  const m = useMutation(ref.updateDraft);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.updateDraft(args) : m(args)), [m]);
}

export function useSaveAnswer(): (args: SaveAnswerArgs) => Promise<unknown> {
  const m = useMutation(ref.saveAnswer);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.saveAnswer(args) : m(args)), [m]);
}

export function useSaveShot(): (args: SaveShotArgs) => Promise<unknown> {
  const m = useMutation(ref.saveShot);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.saveShot(args) : m(args)), [m]);
}

export function useRemoveShot(): (args: Sid & { index: number; extra?: boolean }) => Promise<unknown> {
  const m = useMutation(ref.removeShot);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.removeShot(args) : m(args)), [m]);
}

export function useChooseDesign(): (args: Sid & { templateId: string }) => Promise<unknown> {
  const m = useMutation(ref.chooseDesign);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.chooseDesign(args) : m(args)), [m]);
}

/** Send the interview + photos: starts the ~20 minute build. */
export function useSubmitSite(): (args: Sid) => Promise<unknown> {
  const m = useMutation(ref.submit);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.submit(args) : m(args)), [m]);
}

// ------------------------------------------------------------------ build + check

export function useBuild(id: SubmissionId | null | undefined): BuildState | undefined {
  if (OWNER_SAMPLE_DATA) return useSample(() => (id ? sample.build(id) : undefined)); // eslint-disable-line react-hooks/rules-of-hooks
  return useQuery(ref.getBuild, id ? { submissionId: id } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

export function usePreview(id: SubmissionId | null | undefined): PreviewState | undefined {
  if (OWNER_SAMPLE_DATA) return useSample(() => (id ? sample.preview(id) : undefined)); // eslint-disable-line react-hooks/rules-of-hooks
  return useQuery(ref.getPreview, id ? { submissionId: id } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

export function useApprovePreview(): (args: Sid) => Promise<{ next: 'pay' | 'publish' }> {
  const m = useMutation(ref.approvePreview);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.approve(args) : m(args)), [m]);
}

export function useRequestChange(): (args: Sid & { text: string }) => Promise<unknown> {
  const m = useMutation(ref.requestChange);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.requestChange(args) : m(args)), [m]);
}

// ------------------------------------------------------------------ pay

export function usePaymentState(id: SubmissionId | null | undefined): PaymentState | undefined {
  if (OWNER_SAMPLE_DATA) return useSample(() => (id ? sample.payment(id) : undefined)); // eslint-disable-line react-hooks/rules-of-hooks
  return useQuery(ref.paymentState, id ? { submissionId: id } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

/** The owner's saved creator offer is an order quote, never a client-side discount. */
export function useOwnerCreatorCode(id: SubmissionId | null | undefined): OwnerCreatorCodeState | undefined {
  return useQuery(api.ownerApp.creatorCode, !OWNER_SAMPLE_DATA && id ? { submissionId: id } : skip);
}

export function useApplyOwnerCreatorCode(): (args: Sid & { code: string | null }) => Promise<OwnerCreatorOffer | null> {
  const apply = useMutation(api.ownerApp.applyCreatorCode);
  return useCallback(args => apply(args), [apply]);
}

export function useCreatePayToken(): (args: Sid & { kind: PayKind; amount?: number; expectedTotal?: number }) => Promise<PayToken> {
  const m = useMutation(ref.createPayToken);
  return useCallback((args) => (OWNER_SAMPLE_DATA ? sample.createPayToken(args) : m(args)), [m]);
}

/** A checkout return is only a hint; the server owns expiry and payment status. */
export function useOwnerPaymentAttempt(id: SubmissionId | null, token: string | null): OwnerPaymentAttempt | null | undefined {
  if (OWNER_SAMPLE_DATA) {
    // The sample's memoized payment snapshot keeps this subscription stable.
    const pay = useSample(() => id ? sample.payment(id) : undefined); // eslint-disable-line react-hooks/rules-of-hooks
    return useMemo<OwnerPaymentAttempt | null>(() => !id || !token || !pay?.billable ? null : ({ // eslint-disable-line react-hooks/rules-of-hooks
      submissionId: id, status: pay.paidInFull ? 'paid' : pay.needsApproval ? 'needs_approval' : 'ready',
      kind: pay.canPayBalance ? 'balance' : 'full', amount: pay.balanceDue, expiresAt: Number.MAX_SAFE_INTEGER,
    }), [id, token, pay]);
  }
  return useQuery(ref.paymentAttempt, id && token ? { token, expectedSubmissionId: id } : skip); // eslint-disable-line react-hooks/rules-of-hooks
}

export function useRetryOwnerPayment(): (args: { token: string; expectedSubmissionId: SubmissionId; expectedTotal: number }) => Promise<OwnerPaymentRetry> {
  const retry = useMutation(ref.retryPayment);
  return useCallback(async (args: { token: string; expectedSubmissionId: SubmissionId; expectedTotal: number }): Promise<OwnerPaymentRetry> => {
    if (!OWNER_SAMPLE_DATA) return retry(args);
    const pay = sample.payment(args.expectedSubmissionId);
    if (!pay?.billable) throw new Error('Return to your site to check the latest payment options.');
    if (pay.paidInFull) return { status: 'paid', submissionId: args.expectedSubmissionId };
    if (pay.needsApproval) return { status: 'needs_approval', submissionId: args.expectedSubmissionId };
    const oldAmount = Number(args.token.split(':')[2]);
    const kind = pay.canPayBalance ? 'balance' : oldAmount >= pay.minDownPayment && oldAmount < pay.total ? 'deposit' : 'full';
    const token = await sample.createPayToken({ submissionId: args.expectedSubmissionId, kind, amount: kind === 'deposit' ? oldAmount : undefined });
    return { status: 'ready', submissionId: args.expectedSubmissionId, ...token };
  }, [retry]);
}

/** GCash / Maya / card via Xendit: returns the hosted checkout URL to open in the in-app browser. */
export function useCreateCheckout(): (token: string) => Promise<CheckoutResult> {
  const a = useAction(ref.createCheckout);
  return useCallback(
    (token) =>
      OWNER_SAMPLE_DATA
        ? sample.createCheckout(token)
        : a({ token, successRedirectUrl: wisePayUrl(token), failureRedirectUrl: wisePayUrl(token) }),
    [a],
  );
}

/** Wise bank transfer: the existing web pay page shows the three steps and the reference code. */
export function wisePayUrl(token: string): string {
  const origin = ownerPaymentOrigin({
    configuredOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN,
    convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    productionOrigin: SITE_URL,
  });
  return `${origin}/pay/${encodeURIComponent(token)}`;
}

// ------------------------------------------------------------------ agents

/**
 * Field agents near the owner. No backend lists agents to owners yet (it would need
 * agent locations and consented photos), so a real owner sees none and books a visit,
 * which the team assigns. Sample mode shows the labelled sample agents.
 */
export function useAgentsNear(): NearbyAgent[] {
  return OWNER_SAMPLE_DATA ? sample.agents() : [];
}

/**
 * "Book a visit" = a request the team assigns (FEATURES-QUESTIONS Q14/Q19), not a calendar.
 * Uses the existing public leads.create (lands in admin Leads, unassigned).
 */
export function useRequestVisit(): (req: VisitRequest) => Promise<unknown> {
  const create = useMutation(api.leads.create);
  return useCallback(
    (req) => {
      const message = [
        'Owner app: please visit my shop.',
        req.shopName ? `Shop: ${req.shopName}` : null,
        `When: ${req.when}`,
        req.agentName ? `Asked for: ${req.agentName}` : null,
      ].filter(Boolean).join('\n');
      if (OWNER_SAMPLE_DATA) return sample.requestVisit(req);
      return create({ source: 'direct', name: req.name, phone: req.phone, email: req.email, message });
    },
    [create],
  );
}

/**
 * "Want forgebarbers.com?" — optional custom domain, set up by the team. It lands in
 * admin Leads like a visit request (domain setup itself stays admin-side).
 */
export function useRequestDomain(): (args: { name: string; email?: string; phone?: string; shopName: string; domain: string }) => Promise<unknown> {
  const create = useMutation(api.leads.create);
  return useCallback(
    (a) => {
      if (OWNER_SAMPLE_DATA) return sample.requestVisit({ name: a.name, phone: a.phone ?? '', when: 'domain' });
      return create({
        source: 'direct',
        name: a.name,
        phone: a.phone ?? '',
        email: a.email,
        message: `Owner app: custom domain request.\nShop: ${a.shopName}\nDomain: ${a.domain}`,
      });
    },
    [create],
  );
}

// ------------------------------------------------------------------ uploads

export interface UploadSpec {
  folder: 'videos' | 'audio' | 'images';
  contentType: string;
  filename: string;
}

/**
 * Upload a local file to R2 (existing api.r2.generateUploadUrl, same as the agent
 * flow) and return its public URL — what saveAnswer / saveShot expect.
 */
export function useUploadFile(): (uri: string, spec: UploadSpec) => Promise<string> {
  const generate = useAction(api.r2.generateUploadUrl);
  return useCallback(
    async (uri, spec) => {
      if (OWNER_SAMPLE_DATA) return sample.upload(uri);
      const res = (await generate({ folder: spec.folder, filename: spec.filename, contentType: spec.contentType })) as {
        uploadUrl: string;
        publicUrl?: string;
        fileKey: string;
      };
      const local = uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http') ? uri : `file://${uri}`;
      const blob = await (await fetch(local)).blob();
      const put = await fetch(res.uploadUrl, { method: 'PUT', headers: { 'Content-Type': spec.contentType }, body: blob });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      if (!res.publicUrl) throw new Error('Upload is not configured.');
      return res.publicUrl;
    },
    [generate],
  );
}

/** The newest site (the one the flow works on). */
export function newestSite(me: OwnerMe | null | undefined) {
  return me?.sites?.[0] ?? null;
}
