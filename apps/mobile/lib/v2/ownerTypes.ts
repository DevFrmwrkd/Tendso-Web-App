/**
 * Types of the owner API (contract: docs/v2-api-owners.md on feat/v2-backend-owners,
 * convex/owners.ts, convex/ownerApp.ts, convex/ownerPayments.ts, convex/xendit.ts).
 * Plain types for the screens; lib/v2/ownerData.ts checks the backend's real
 * return shapes against them, so a drift fails the typecheck.
 */

import type { Id } from '@tendso/convex-client';

export type OwnerPhase =
  | 'draft'
  | 'building'
  | 'ready_to_check'
  | 'changes_requested'
  | 'awaiting_payment'
  | 'publishing'
  | 'live'
  | 'offline'
  | 'in_review'
  | 'rejected';

/** A submission id (a string on the wire). */
export type SubmissionId = Id<'submissions'>;

export interface SiteSummary {
  submissionId: SubmissionId;
  businessName: string;
  businessType: string;
  contentSource: string | null;
  publishPolicy: 'publish_first' | 'pay_then_publish';
  status: string;
  phase: OwnerPhase;
  publishedUrl: string | null;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paidInFull: boolean;
  openChangeRequests: number;
  createdAt: number;
}

export interface OwnerMe {
  owner: { _id: string; email: string; name: string | null; phone: string | null };
  sites: SiteSummary[];
}

export interface EnsureResult {
  ownerId: string;
  email: string;
  name: string | null;
  created: boolean;
  linkedSubmissionIds: SubmissionId[];
}

export type CreateDraftArgs = {
  businessType: string;
  businessName: string;
  address?: string;
  city?: string;
  province?: string;
  barangay?: string;
  coordinates?: { lat: number; lng: number };
  shotListKey?: string;
};

export type UpdateDraftArgs = Partial<CreateDraftArgs> & {
  submissionId: SubmissionId;
  ownerName?: string;
  ownerPhone?: string;
};

export interface InterviewAnswer {
  index: number;
  questionEn: string;
  questionTl: string;
  lang: 'en' | 'tl';
  answerText?: string;
  mediaUrl?: string;
  mediaType?: 'video' | 'audio';
  durationSec?: number;
  updatedAt: number;
}

export interface OwnerShot {
  index: number;
  url: string;
  label?: string;
  extra: boolean;
  updatedAt: number;
}

export type SaveAnswerArgs = {
  submissionId: SubmissionId;
  index: number;
  lang: 'en' | 'tl';
  answerText?: string;
  mediaUrl?: string;
  mediaType?: 'video' | 'audio';
  durationSec?: number;
};

export type SaveShotArgs = {
  submissionId: SubmissionId;
  index: number;
  url: string;
  label?: string;
  extra?: boolean;
};

export interface OwnerSubmission extends SiteSummary {
  address: string;
  city: string;
  province: string | null;
  barangay: string | null;
  coordinates: { lat: number; lng: number } | null;
  shotListKey: string | null;
  interview: InterviewAnswer[];
  shots: OwnerShot[];
  templateId: string | null;
  templateIds: string[];
  fontChoice: string | null;
  colorChoice: string | null;
  ownerApprovedAt: number | null;
  previewReadyAt: number | null;
}

export type BuildStepKey = 'reading_interview' | 'writing_pages' | 'polishing_photos' | 'building_site';
export type BuildStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface BuildState {
  phase: OwnerPhase;
  steps: { key: BuildStepKey; label: string; status: BuildStepStatus; startedAt: number | null; finishedAt: number | null; error: string | null }[];
  doneCount: number;
  estimateMinutes: number;
  buildStartedAt: number | null;
  previewReadyAt: number | null;
  openChangeRequests: number;
}

export interface PreviewState {
  ready: boolean;
  htmlUrl: string | null;
  inlineHtml: string | null;
  isLive: boolean;
  publishedUrl: string | null;
}

export interface ChangeRequest {
  _id: string;
  submissionId: SubmissionId;
  text: string;
  status: 'open' | 'done' | 'declined' | string;
  createdAt: number;
}

export type PayKind = 'full' | 'deposit' | 'balance';

export type PaymentState =
  | { billable: false; status: string }
  | {
      billable: true;
      status: string;
      total: number;
      amountPaid: number;
      balanceDue: number;
      paidInFull: boolean;
      depositPaid: boolean;
      minDownPayment: number;
      canPayFull: boolean;
      canPayDeposit: boolean;
      canPayBalance: boolean;
      needsApproval: boolean;
      xenditEnabled: boolean;
      pendingTokens: { token: string; referenceCode: string; kind: PayKind; amount: number; expiresAt: number; checkoutUrl: string | null }[];
    };

export interface PayToken {
  token: string;
  referenceCode: string;
  kind: PayKind;
  amount: number;
  expiresAt: number;
}

export interface OwnerCreatorOffer {
  name: string;
  code: string | null;
  handle: string;
  photo: string | null;
  listPrice: number;
  total: number;
  saving: number;
}
export interface OwnerCreatorCodeState {
  applied: OwnerCreatorOffer | null;
  editable: boolean;
  reason: string | null;
  total: number;
}

export type CheckoutResult =
  | { enabled: false }
  | { enabled: true; checkoutUrl: string; invoiceId: string; expiresAt: number | null; amount: number; referenceCode: string };

/** A field agent the owner can ask to visit (sample until the backend lists real ones). */
export interface NearbyAgent {
  id: string;
  name: string;
  distance: string;
  note: string;
  sites: number;
  face: { source: number; aspect: number; fx: number; fy: number; zoom: number };
}

export interface VisitRequest {
  name: string;
  phone: string;
  email?: string;
  shopName?: string;
  when: string;
  agentName?: string;
}
