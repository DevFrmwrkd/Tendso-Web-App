import { sample, SAMPLE_STEP_MS } from '../lib/v2/ownerSample';
import { uploadQueue } from '../lib/v2/uploadQueue';
import type { SubmissionId } from '../lib/v2/ownerTypes';

describe('sample owner backend (same shapes as the contract)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    sample.reset();
  });
  afterEach(() => {
    sample.reset();
    jest.useRealTimers();
  });

  it('walks a site from draft to live: build → check → pay → publish', async () => {
    expect(sample.me()).toBeNull();
    await sample.ensure({ name: 'Ben Reyes' });
    const id = await sample.createDraft({ businessType: 'Barber/Salon', businessName: 'Forge Barbers', address: '12 J.P. Rizal St', shotListKey: 'barber' });
    expect(sample.me()!.sites[0]).toMatchObject({ submissionId: id, phase: 'draft', total: 4999 });

    await sample.saveAnswer({ submissionId: id, index: 0, lang: 'en', mediaUrl: 'file://a.mp4', mediaType: 'video', durationSec: 12 });
    await sample.saveAnswer({ submissionId: id, index: 10, lang: 'tl', answerText: 'Wala na' });
    expect(sample.submission(id)!.interview.map((a) => a.questionEn)).toEqual(["What's your shop called?", 'Anything else?']);
    for (let i = 0; i < 3; i++) await sample.saveShot({ submissionId: id, index: i, url: `file://p${i}.jpg` });
    await sample.chooseDesign({ submissionId: id, templateId: 'barbershop:F' });
    await sample.submit({ submissionId: id });

    expect(sample.build(id)!.phase).toBe('building');
    expect(sample.build(id)!.steps[0].status).toBe('running');
    jest.advanceTimersByTime(SAMPLE_STEP_MS * 2 + 10);
    expect(sample.build(id)!.doneCount).toBe(2);
    jest.advanceTimersByTime(SAMPLE_STEP_MS * 2);
    expect(sample.build(id)!.phase).toBe('ready_to_check');
    expect(sample.preview(id)!.htmlUrl).toContain('/template-previews/f.html');

    const pay0 = sample.payment(id)!;
    expect(pay0.billable && pay0.needsApproval).toBe(true);
    expect((await sample.approve({ submissionId: id })).next).toBe('pay');
    expect(sample.me()!.sites[0].phase).toBe('awaiting_payment');

    const token = await sample.createPayToken({ submissionId: id, kind: 'deposit', amount: 1000 });
    expect(token.amount).toBe(1000);
    await sample.createCheckout(token.token);
    expect(sample.me()!.sites[0].phase).toBe('publishing');
    jest.advanceTimersByTime(5000);
    const live = sample.me()!.sites[0];
    expect(live.phase).toBe('live');
    expect(live.publishedUrl).toBe('https://forgebarbers.sites.tendso.com');
    expect(live.balanceDue).toBe(3999);
  });

  it('a change request sends the site back to building', async () => {
    const id = await sample.createDraft({ businessType: 'Auto Shop', businessName: 'Vulca' });
    await sample.submit({ submissionId: id });
    jest.advanceTimersByTime(SAMPLE_STEP_MS * 4 + 10);
    await sample.requestChange({ submissionId: id, text: 'Bigger phone number' });
    expect(sample.build(id)!.phase).toBe('changes_requested');
    await expect(sample.requestChange({ submissionId: id, text: '  ' })).rejects.toThrow();
  });

  it('keeps snapshots stable between changes (useSyncExternalStore)', async () => {
    await sample.ensure({});
    expect(sample.me()).toBe(sample.me());
  });

  it('lists sample agents with faces', () => {
    expect(sample.agents().length).toBeGreaterThanOrEqual(3);
    sample.agents().forEach((a) => expect(a.face.zoom).toBeGreaterThan(1));
  });
});

describe('upload queue', () => {
  beforeEach(() => uploadQueue.reset());

  it('runs jobs one by one, retries, and reports failures', async () => {
    const order: string[] = [];
    let flaky = 0;
    uploadQueue.add('a', 'A', async () => { order.push('a'); });
    uploadQueue.add('b', 'B', async () => {
      flaky += 1;
      if (flaky < 2) throw new Error('network');
      order.push('b');
    });
    uploadQueue.add('c', 'C', async () => { throw new Error('always'); });
    await uploadQueue.drain();
    expect(order).toEqual(['a', 'b']);
    expect(uploadQueue.snapshot()).toMatchObject({ total: 3, done: 2, failed: 1, pending: 0 });
  });

  it('a retake replaces the waiting job with the same id', async () => {
    const ran: string[] = [];
    uploadQueue.add('x', 'X', () => new Promise((r) => setTimeout(r, 5)).then(() => { ran.push('first'); }));
    uploadQueue.add('y', 'Y', async () => { ran.push('y1'); });
    uploadQueue.add('y', 'Y', async () => { ran.push('y2'); });
    await uploadQueue.drain();
    expect(ran).toEqual(['first', 'y2']);
  });

  it('retry() runs failed jobs again', async () => {
    let n = 0;
    uploadQueue.add('z', 'Z', async () => { n += 1; if (n <= 3) throw new Error('no'); });
    await uploadQueue.drain();
    expect(uploadQueue.snapshot().failed).toBe(1);
    uploadQueue.retry();
    await uploadQueue.drain();
    expect(uploadQueue.snapshot().failed).toBe(0);
  });

  it('a reset does not let an old worker consume the new account queue', async () => {
    let finishOld!: () => void;
    const old = new Promise<void>((resolve) => { finishOld = resolve; });
    uploadQueue.add('old', 'Old account', () => old);
    uploadQueue.reset();
    let finishNew!: () => void;
    const next = new Promise<void>((resolve) => { finishNew = resolve; });
    const order: string[] = [];
    uploadQueue.add('new', 'New account', async () => { await next; order.push('new'); });
    uploadQueue.add('after', 'After', async () => { order.push('after'); });
    finishOld();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(uploadQueue.snapshot().pending).toBe(2);
    finishNew();
    await uploadQueue.drain();
    expect(order).toEqual(['new', 'after']);
  });
});

// keep the type import used
export type _Sid = SubmissionId;
