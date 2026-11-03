import { ownerIntake } from './ownerIntake';
import type { SubmissionId } from './ownerTypes';

const queues = new Map<string, Promise<unknown>>();
const queueScopes = new Map<string, number>();
let checkpoint: { scope: number; save: (explicit?: boolean) => Promise<void> } | null = null;
type Context = { actorClerkId: string | null | undefined; sessionId?: string | null };
type DraftArgs = { submissionId: SubmissionId };
type Guard = { actorClerkId: string; expectedRevision: number };

export function ownerDraftError(cause: unknown): Error {
  const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null;
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return new Error(data.message);
  return cause instanceof Error ? cause : new Error('Could not save your draft. Please reconnect and try again.');
}

/** One revision queue for details, capture uploads, progress, design and submit. */
export function writeOwnerDraft<A extends DraftArgs, R>(context: Context, args: A, write: (guarded: A & Guard) => Promise<R>): Promise<R> {
  const scope = ownerIntake.scope();
  const actor = context.actorClerkId;
  const key = `${actor}:${context.sessionId ?? ''}:${scope}:${args.submissionId}`;
  const current = () => !!actor && ownerIntake.actor() === actor && ownerIntake.isCurrent(scope);
  const before = queues.get(key) ?? Promise.resolve();
  const request = before.catch(() => {}).then(async () => {
    if (!current()) throw new Error('Your account or business changed. Reopen this draft to continue.');
    const expectedRevision = ownerIntake.revision(args.submissionId);
    if (expectedRevision === undefined) throw new Error('Open the latest saved version of this draft before making changes.');
    ownerIntake.beginWrite(args.submissionId);
    try {
      const result = await write({ ...args, actorClerkId: actor!, expectedRevision });
      if (current() && result && typeof result === 'object' && 'draftRevision' in result && typeof result.draftRevision === 'number')
        ownerIntake.acknowledge(args.submissionId, result.draftRevision, scope, args as A & Record<string, unknown>);
      return result;
    } catch (cause) { throw ownerDraftError(cause); }
    finally { ownerIntake.finishWrite(args.submissionId, scope); }
  });
  queues.set(key, request);
  queueScopes.set(key, scope);
  void request.finally(() => { if (queues.get(key) === request) { queues.delete(key); queueScopes.delete(key); } }).catch(() => {});
  return request;
}

/** Save & exit waits for acknowledged cloud metadata; upload files remain journaled separately. */
export async function flushOwnerDraftWrites() {
  const scope = ownerIntake.scope();
  await Promise.all([...queues].filter(([key]) => queueScopes.get(key) === scope).map(([, promise]) => promise));
}

export function registerOwnerDraftCheckpoint(save: (explicit?: boolean) => Promise<void>) {
  const entry = { scope: ownerIntake.scope(), save }; checkpoint = entry;
  return () => { if (checkpoint === entry) checkpoint = null; };
}
export async function checkpointOwnerDraft() {
  const entry = checkpoint;
  if (entry && ownerIntake.isCurrent(entry.scope)) await entry.save(true);
  await flushOwnerDraftWrites();
}
