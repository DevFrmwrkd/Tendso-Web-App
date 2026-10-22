/**
 * Background uploads for the owner capture: each answer / photo uploads while the
 * owner carries on. One at a time, two retries, observable from any screen.
 */
import { useSyncExternalStore } from 'react';

export type JobStatus = 'waiting' | 'running' | 'done' | 'failed';

interface Job {
  id: string;
  label: string;
  run: () => Promise<unknown>;
  status: JobStatus;
  tries: number;
  error?: string;
}

export interface QueueSnapshot {
  total: number;
  done: number;
  failed: number;
  pending: number;
}

const MAX_TRIES = 3;
let jobs: Job[] = [];
let running = false;
let snapshot: QueueSnapshot = { total: 0, done: 0, failed: 0, pending: 0 };
const listeners = new Set<() => void>();
let idle: (() => void)[] = [];

function recompute() {
  const done = jobs.filter((j) => j.status === 'done').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  snapshot = { total: jobs.length, done, failed, pending: jobs.length - done - failed };
  listeners.forEach((l) => l());
  if (snapshot.pending === 0) {
    const waiters = idle;
    idle = [];
    waiters.forEach((w) => w());
  }
}

async function pump() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = jobs.find((j) => j.status === 'waiting');
      if (!job) break;
      job.status = 'running';
      recompute();
      try {
        await job.run();
        job.status = 'done';
      } catch (e: any) {
        job.tries += 1;
        job.error = e?.message ?? String(e);
        job.status = job.tries >= MAX_TRIES ? 'failed' : 'waiting';
      }
      recompute();
    }
  } finally {
    running = false;
  }
}

export const uploadQueue = {
  /** Add a job. A job with the same id replaces a waiting / failed one (a retake). */
  add(id: string, label: string, run: () => Promise<unknown>) {
    jobs = jobs.filter((j) => !(j.id === id && j.status !== 'running' && j.status !== 'done'));
    jobs.push({ id, label, run, status: 'waiting', tries: 0 });
    recompute();
    void pump();
  },
  /** Try the failed ones again. */
  retry() {
    jobs.forEach((j) => {
      if (j.status === 'failed') {
        j.status = 'waiting';
        j.tries = 0;
      }
    });
    recompute();
    void pump();
  },
  /** Resolves when nothing is waiting or running. */
  drain(): Promise<void> {
    if (snapshot.pending === 0) return Promise.resolve();
    return new Promise((resolve) => idle.push(resolve));
  },
  snapshot(): QueueSnapshot {
    return snapshot;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Tests / sign-out. */
  reset() {
    jobs = [];
    running = false;
    recompute();
  },
};

export function useUploadQueue(): QueueSnapshot {
  return useSyncExternalStore(uploadQueue.subscribe, uploadQueue.snapshot, uploadQueue.snapshot);
}
