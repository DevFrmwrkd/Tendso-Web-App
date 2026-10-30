/**
 * Typed SAMPLE data for the owner path (EXPO_PUBLIC_OWNER_SAMPLE_DATA=1), plus the
 * sample field agents shown until the backend can list real ones.
 *
 * An in-memory store with the same shapes as the backend contract, so every owner
 * screen can be walked end to end — including a simulated ~20 minute build that is
 * sped up to about 30 seconds. Nothing here is ever sent anywhere.
 */
import { EXTRA_QUESTION, INTERVIEW_QUESTIONS } from './captureContent';
import { designsFor, sellKindFromServer, slugGuess, freeAddress, PRICE_ONCE, MIN_DOWN_PAYMENT } from './ownerContent';
import type {
  BuildState,
  BuildStepKey,
  CheckoutResult,
  CreateDraftArgs,
  EnsureResult,
  NearbyAgent,
  OwnerMe,
  OwnerPhase,
  OwnerSubmission,
  PayKind,
  PaymentState,
  PayToken,
  PreviewState,
  SaveAnswerArgs,
  SaveShotArgs,
  SiteSummary,
  SubmissionId,
  UpdateDraftArgs,
  VisitRequest,
} from './ownerTypes';

type Listener = () => void;

const STEP_KEYS: BuildStepKey[] = ['reading_interview', 'writing_pages', 'polishing_photos', 'building_site'];
const STEP_LABELS: Record<BuildStepKey, string> = {
  reading_interview: 'Reading your interview',
  writing_pages: 'Writing your pages',
  polishing_photos: 'Polishing your photos',
  building_site: 'Building your site',
};
/** Sample build: each step takes this long (the real one is about 20 minutes in total). */
export const SAMPLE_STEP_MS = 7000;

interface SampleSite {
  sub: OwnerSubmission;
  buildStartedAt: number | null;
  approvedAt: number | null;
  paid: number;
  changes: number;
  changeAt: number | null;
  publishedAt: number | null;
}

let owner: OwnerMe['owner'] | null = null;
let sites: SampleSite[] = [];
let seq = 1;
const listeners = new Set<Listener>();
let clock: ReturnType<typeof setInterval> | null = null;
let version = 0;
const cache = new Map<string, { v: number; value: unknown }>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

/** useSyncExternalStore needs stable snapshots: memoise per store version. */
function memo<T>(key: string, compute: () => T): T {
  const hit = cache.get(key);
  if (hit && hit.v === version) return hit.value as T;
  const value = compute();
  cache.set(key, { v: version, value });
  return value;
}

function tickWhileBuilding() {
  if (clock) return;
  clock = setInterval(() => {
    const busy = sites.some((s) => phaseOf(s) === 'building' || phaseOf(s) === 'changes_requested' || phaseOf(s) === 'publishing');
    if (!busy && clock) {
      clearInterval(clock);
      clock = null;
    }
    emit();
  }, 1000);
}

function now() {
  return Date.now();
}

function find(id: SubmissionId): SampleSite {
  const s = sites.find((x) => x.sub.submissionId === id);
  if (!s) throw new Error('We could not find that website.');
  return s;
}

function doneSteps(s: SampleSite): number {
  if (!s.buildStartedAt) return 0;
  return Math.min(4, Math.floor((now() - s.buildStartedAt) / SAMPLE_STEP_MS));
}

function phaseOf(s: SampleSite): OwnerPhase {
  if (s.sub.status === 'draft') return 'draft';
  if (s.publishedAt) return now() - s.publishedAt > 4000 ? 'live' : 'publishing';
  if (s.changeAt && now() - s.changeAt < SAMPLE_STEP_MS * 2) return 'changes_requested';
  if (doneSteps(s) < 4) return 'building';
  if (s.paid > 0) return 'publishing';
  if (!s.approvedAt) return 'ready_to_check';
  return 'awaiting_payment';
}

function summary(s: SampleSite): SiteSummary {
  const phase = phaseOf(s);
  return {
    ...s.sub,
    phase,
    amountPaid: s.paid,
    balanceDue: Math.max(0, s.sub.total - s.paid),
    paidInFull: s.paid >= s.sub.total,
    openChangeRequests: phase === 'changes_requested' ? s.changes : 0,
    publishedUrl: phase === 'live' ? `https://${freeAddress(slugGuess(s.sub.businessName))}` : null,
  };
}

const AGENTS: NearbyAgent[] = [
  {
    id: 'sample-mika', name: 'Mika Santos', distance: '350 m', note: 'Free today', sites: 23,
    face: { source: require('../../assets/v2/owner/agent-mika.jpg'), aspect: 0.8, fx: 0.51, fy: 0.21, zoom: 3.6 },
  },
  {
    id: 'sample-jun', name: 'Jun Dela Cruz', distance: '1.2 km', note: 'Tomorrow', sites: 11,
    face: { source: require('../../assets/v2/owner/agent-jun.jpg'), aspect: 1.25, fx: 0.3, fy: 0.25, zoom: 6 },
  },
  {
    id: 'sample-bea', name: 'Bea Ramos', distance: '2.4 km', note: 'Free today', sites: 17,
    face: { source: require('../../assets/v2/owner/agent-bea.jpg'), aspect: 0.8, fx: 0.67, fy: 0.29, zoom: 5.5 },
  },
];

export const sample = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  /** Clears everything (tests). */
  reset() {
    owner = null;
    sites = [];
    seq = 1;
    if (clock) clearInterval(clock);
    clock = null;
    emit();
  },

  me(): OwnerMe | null {
    return memo('me', () => (owner ? { owner, sites: sites.map(summary).sort((a, b) => b.createdAt - a.createdAt) } : null));
  },

  async ensure(args: { name?: string; phone?: string }): Promise<EnsureResult> {
    const created = !owner;
    owner = owner ?? { _id: 'sample-owner', email: 'ben@example.com', name: args.name ?? 'Ben', phone: args.phone ?? null };
    if (args.name) owner = { ...owner, name: args.name };
    emit();
    return { ownerId: owner._id, email: owner.email, name: owner.name, created, linkedSubmissionIds: [] };
  },

  submission(id: SubmissionId): OwnerSubmission | undefined {
    return memo(`sub:${id}`, () => {
      const s = sites.find((x) => x.sub.submissionId === id);
      return s ? { ...s.sub, ...summary(s), ownerApprovedAt: s.approvedAt, previewReadyAt: doneSteps(s) >= 4 ? (s.buildStartedAt ?? 0) + 4 * SAMPLE_STEP_MS : null } : undefined;
    });
  },

  async createDraft(args: CreateDraftArgs): Promise<SubmissionId> {
    if (!owner) await sample.ensure({});
    const id = `sample-site-${seq++}` as SubmissionId;
    sites.unshift({
      sub: {
        submissionId: id,
        businessName: args.businessName,
        businessType: args.businessType,
        contentSource: 'owner_app',
        publishPolicy: 'pay_then_publish',
        status: 'draft',
        phase: 'draft',
        publishedUrl: null,
        total: PRICE_ONCE,
        amountPaid: 0,
        balanceDue: PRICE_ONCE,
        paidInFull: false,
        openChangeRequests: 0,
        createdAt: now(),
        address: args.address ?? '',
        city: args.city ?? '',
        province: null,
        barangay: null,
        coordinates: args.coordinates ?? null,
        shotListKey: args.shotListKey ?? null,
        interview: [],
        shots: [],
        templateId: null,
        templateIds: [],
        fontChoice: null,
        colorChoice: null,
        ownerApprovedAt: null,
        previewReadyAt: null,
      },
      buildStartedAt: null,
      approvedAt: null,
      paid: 0,
      changes: 0,
      changeAt: null,
      publishedAt: null,
    });
    emit();
    return id;
  },

  async updateDraft(args: UpdateDraftArgs) {
    const s = find(args.submissionId);
    const { submissionId: _ignored, ...rest } = args;
    s.sub = { ...s.sub, ...(rest as Partial<OwnerSubmission>) };
    emit();
    return { ok: true as const };
  },

  async saveAnswer(args: SaveAnswerArgs) {
    const s = find(args.submissionId);
    const q = args.index >= INTERVIEW_QUESTIONS.length ? EXTRA_QUESTION : INTERVIEW_QUESTIONS[args.index];
    const rest = s.sub.interview.filter((a) => a.index !== args.index);
    s.sub = {
      ...s.sub,
      interview: [...rest, { index: args.index, questionEn: q.en, questionTl: q.tl, lang: args.lang, answerText: args.answerText, mediaUrl: args.mediaUrl, mediaType: args.mediaType, durationSec: args.durationSec, updatedAt: now() }]
        .sort((a, b) => a.index - b.index),
    };
    emit();
    return { answered: s.sub.interview.length };
  },

  async saveShot(args: SaveShotArgs) {
    const s = find(args.submissionId);
    const extra = args.extra === true;
    const rest = s.sub.shots.filter((x) => !(x.index === args.index && x.extra === extra));
    s.sub = { ...s.sub, shots: [...rest, { index: args.index, url: args.url, label: args.label, extra, updatedAt: now() }] };
    emit();
    return { photos: s.sub.shots.length };
  },

  async removeShot(args: { submissionId: SubmissionId; index: number; extra?: boolean }) {
    const s = find(args.submissionId);
    s.sub = { ...s.sub, shots: s.sub.shots.filter((x) => !(x.index === args.index && x.extra === (args.extra === true))) };
    emit();
    return { photos: s.sub.shots.length };
  },

  async chooseDesign(args: { submissionId: SubmissionId; templateId: string }) {
    const s = find(args.submissionId);
    s.sub = { ...s.sub, templateId: args.templateId, templateIds: [args.templateId] };
    emit();
    return { ok: true as const };
  },

  async submit(args: { submissionId: SubmissionId }) {
    const s = find(args.submissionId);
    if (s.sub.status === 'draft') {
      s.sub = { ...s.sub, status: 'submitted' };
      s.buildStartedAt = now();
      tickWhileBuilding();
    }
    emit();
    return { submissionId: args.submissionId, status: 'submitted' };
  },

  build(id: SubmissionId): BuildState | undefined {
    return memo(`build:${id}`, () => {
      const s = sites.find((x) => x.sub.submissionId === id);
      if (!s) return undefined;
      const done = doneSteps(s);
      return {
        phase: phaseOf(s),
        steps: STEP_KEYS.map((key, i) => ({
          key,
          label: STEP_LABELS[key],
          status: i < done ? 'done' : i === done && s.buildStartedAt ? 'running' : 'pending',
          startedAt: null,
          finishedAt: null,
          error: null,
        })),
        doneCount: done,
        estimateMinutes: 20,
        buildStartedAt: s.buildStartedAt,
        previewReadyAt: done >= 4 ? (s.buildStartedAt ?? 0) + 4 * SAMPLE_STEP_MS : null,
        openChangeRequests: phaseOf(s) === 'changes_requested' ? s.changes : 0,
      };
    });
  },

  preview(id: SubmissionId): PreviewState | undefined {
    return memo(`preview:${id}`, () => {
      const s = sites.find((x) => x.sub.submissionId === id);
      if (!s) return undefined;
      const kind = sellKindFromServer(s.sub.businessType, s.sub.shotListKey);
      const design = designsFor(kind.id).find((d) => d.code === s.sub.templateId) ?? designsFor(kind.id)[0];
      const origin = (process.env.EXPO_PUBLIC_WEB_ORIGIN || 'https://www.tendso.com').replace(/\/$/, '');
      const live = phaseOf(s) === 'live';
      return {
        ready: doneSteps(s) >= 4,
        htmlUrl: `${origin}${design.preview}`,
        inlineHtml: null,
        isLive: live,
        publishedUrl: live ? `https://${freeAddress(slugGuess(s.sub.businessName))}` : null,
      };
    });
  },

  async approve(args: { submissionId: SubmissionId }) {
    const s = find(args.submissionId);
    s.approvedAt = now();
    emit();
    return { next: s.paid > 0 ? ('publish' as const) : ('pay' as const) };
  },

  async requestChange(args: { submissionId: SubmissionId; text: string }) {
    const s = find(args.submissionId);
    if (!args.text.trim()) throw new Error('What should we change?');
    s.changes += 1;
    s.changeAt = now();
    s.approvedAt = null;
    tickWhileBuilding();
    emit();
    return `sample-change-${s.changes}`;
  },

  payment(id: SubmissionId): PaymentState | undefined {
    return memo(`pay:${id}`, () => {
      const s = sites.find((x) => x.sub.submissionId === id);
      if (!s) return undefined;
      const total = s.sub.total;
      const paidInFull = s.paid >= total;
      return {
        billable: true as const,
        status: s.sub.status,
        total,
        amountPaid: s.paid,
        balanceDue: Math.max(0, total - s.paid),
        paidInFull,
        depositPaid: s.paid > 0 && !paidInFull,
        minDownPayment: MIN_DOWN_PAYMENT,
        canPayFull: s.paid === 0,
        canPayDeposit: s.paid === 0 && total > MIN_DOWN_PAYMENT,
        canPayBalance: s.paid > 0 && !paidInFull,
        needsApproval: !s.approvedAt,
        xenditEnabled: true,
        pendingTokens: [],
      };
    });
  },

  async createPayToken(args: { submissionId: SubmissionId; kind: PayKind; amount?: number }): Promise<PayToken> {
    const s = find(args.submissionId);
    const amount = args.kind === 'full' ? s.sub.total : args.kind === 'balance' ? s.sub.total - s.paid : args.amount ?? MIN_DOWN_PAYMENT;
    return { token: `sample:${args.submissionId}:${amount}`, referenceCode: 'TND-SAMPLE', kind: args.kind, amount, expiresAt: now() + 86400000 };
  },

  /** Sample checkout: pretends the payment went through. */
  async createCheckout(token: string): Promise<CheckoutResult> {
    const [, id, amount] = token.split(':');
    const s = find(id as SubmissionId);
    s.paid = Math.min(s.sub.total, s.paid + Number(amount));
    s.publishedAt = now();
    tickWhileBuilding();
    emit();
    return { enabled: false };
  },

  agents(): NearbyAgent[] {
    return AGENTS;
  },

  async requestVisit(_req: VisitRequest) {
    return 'sample-lead';
  },

  async upload(uri: string): Promise<string> {
    return uri;
  },
};
