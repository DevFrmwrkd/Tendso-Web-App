import {
  initialInterview,
  interviewReducer,
  isLastQuestion,
  segmentStates,
  initialShots,
  shotReducer,
  shotsDone,
  takenCount,
} from '../components/v2/capture/machines';
import {
  FRAMING_GIVE_UP_MS,
  formatClock,
  framingPassed,
  initialFraming,
  isLevel,
  levelLineDegrees,
  meterBars,
  meterLevel,
  pitchDegrees,
  rollDegrees,
  shakiness,
  shotFeedback,
  stepFraming,
} from '../components/v2/capture/level';
import {
  CAM_LABELS,
  EXTRA_QUESTION_INDEX,
  INTERVIEW_QUESTIONS,
  KIND_HINT,
  SHOT_LISTS,
  questionAt,
  shotList,
  shotListKeyForBusinessType,
} from '../lib/v2/captureContent';

describe('interview state machine', () => {
  it('checks framing once, then asks 10 questions and "Anything else?", then finishes', () => {
    let s = initialInterview(10);
    expect(s.phase).toBe('framing');
    // Next does nothing while framing
    expect(interviewReducer(s, { type: 'NEXT' })).toBe(s);
    s = interviewReducer(s, { type: 'FRAMING_GOOD' });
    expect(s.framingGood).toBe(true);
    s = interviewReducer(s, { type: 'BEGIN' });
    expect(s.phase).toBe('asking');
    for (let i = 0; i < 10; i++) {
      expect(isLastQuestion(s)).toBe(false);
      s = interviewReducer(s, { type: 'NEXT' });
    }
    expect(s.q).toBe(10);
    expect(isLastQuestion(s)).toBe(true);
    expect(segmentStates(s).every((x) => x === 'done')).toBe(true);
    s = interviewReducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('done');
  });

  it('pauses and resumes without moving the question', () => {
    let s = interviewReducer(interviewReducer(initialInterview(10), { type: 'BEGIN' }), { type: 'NEXT' });
    s = interviewReducer(s, { type: 'PAUSE' });
    expect(s.phase).toBe('paused');
    expect(interviewReducer(s, { type: 'NEXT' })).toBe(s); // Next is "Go on" while paused
    s = interviewReducer(s, { type: 'RESUME' });
    expect(s).toMatchObject({ phase: 'asking', q: 1 });
  });

  it('marks done / current / todo segments', () => {
    const s = { ...initialInterview(10), phase: 'asking' as const, q: 3 };
    expect(segmentStates(s).slice(0, 5)).toEqual(['done', 'done', 'done', 'cur', 'todo']);
  });

  it('can resume at a later question', () => {
    expect(initialInterview(10, 4).q).toBe(4);
    expect(initialInterview(10, 99).q).toBe(10);
  });

  it('finishes a targeted answer replacement without asking later or extra questions', () => {
    let state = initialInterview(10, 4, 4);
    state = interviewReducer(state, { type: 'BEGIN' });
    expect(state.q).toBe(4);
    expect(isLastQuestion(state)).toBe(true);
    state = interviewReducer(state, { type: 'NEXT' });
    expect(state).toMatchObject({ phase: 'done', q: 4 });
    expect(initialInterview(10, 4).stopAfterQuestion).toBeUndefined();
  });
});

describe('photo state machine', () => {
  it('takes photo after photo and is done after the last task', () => {
    let s = initialShots(3);
    s = shotReducer(s, { type: 'TAKE', uri: 'a' });
    s = shotReducer(s, { type: 'TAKE', uri: 'b' });
    expect(s.cur).toBe(2);
    expect(s.last).toBe('b');
    s = shotReducer(s, { type: 'TAKE', uri: 'c' });
    expect(shotsDone(s)).toBe(true);
    expect(takenCount(s)).toBe(3);
  });

  it('skips, and a retake from the strip jumps back then continues to the next open task', () => {
    let s = initialShots(4);
    s = shotReducer(s, { type: 'TAKE', uri: 'a' });
    s = shotReducer(s, { type: 'SKIP' });
    s = shotReducer(s, { type: 'TAKE', uri: 'c' });
    expect(s.taken).toEqual(['a', null, 'c', null]);
    s = shotReducer(s, { type: 'GOTO', index: 0 });
    s = shotReducer(s, { type: 'TAKE', uri: 'a2' });
    expect(s.taken[0]).toBe('a2');
    expect(s.cur).toBe(1); // the skipped one is next
  });

  it('resumes from photos already taken', () => {
    const s = initialShots(3, ['x', null, 'z']);
    expect(s.cur).toBe(1);
    expect(s.last).toBe('z');
    expect(shotsDone(initialShots(2, ['x', 'y']))).toBe(true);
  });

  it('ignores a bad strip index', () => {
    const s = initialShots(3);
    expect(shotReducer(s, { type: 'GOTO', index: 7 })).toBe(s);
  });
});

describe('level heuristics', () => {
  const upright = { x: 0, y: -1, z: 0 };
  const tilted = { x: Math.sin(0.2), y: -Math.cos(0.2), z: 0 }; // ~11.5°

  it('reads roll and pitch from gravity', () => {
    expect(Math.abs(rollDegrees(upright))).toBeLessThan(0.001);
    expect(rollDegrees(tilted)).toBeCloseTo(11.46, 1);
    expect(pitchDegrees({ x: 0, y: 0, z: -1 })).toBeCloseTo(90, 0);
    expect(Math.abs(pitchDegrees(upright))).toBeLessThan(0.001);
  });

  it('uses hysteresis so the hint does not flicker', () => {
    expect(isLevel(4, false)).toBe(false);
    expect(isLevel(4, true)).toBe(true);
    expect(isLevel(7, true)).toBe(false);
    expect(isLevel(2, false)).toBe(true);
  });

  it('never spins the level line', () => {
    expect(levelLineDegrees(90)).toBe(-25);
    expect(levelLineDegrees(-3)).toBe(3);
  });

  it('measures framing once: level and still for 0.7 s', () => {
    let f = initialFraming;
    for (let i = 0; i < 6; i++) f = stepFraming(f, upright, 100, 0);
    expect(f.good).toBe(false);
    f = stepFraming(f, upright, 100, 0);
    expect(f.good).toBe(true);
    // sticky
    expect(stepFraming(f, tilted, 100, 1)).toBe(f);
  });

  it('resets the steady time when the phone tilts or shakes', () => {
    let f = initialFraming;
    for (let i = 0; i < 5; i++) f = stepFraming(f, upright, 100, 0);
    f = stepFraming(f, tilted, 100, 0);
    expect(f.steadyMs).toBe(0);
    f = stepFraming(f, upright, 100, 0.5);
    expect(f.steadyMs).toBe(0);
  });

  it('gives up waiting after a few seconds, and works without a sensor', () => {
    let f = initialFraming;
    for (let t = 0; t < FRAMING_GIVE_UP_MS; t += 100) f = stepFraming(f, tilted, 100, 0);
    expect(f.good).toBe(true);
    let n = initialFraming;
    for (let i = 0; i < 12; i++) n = stepFraming(n, null, 100, 0);
    expect(n.good).toBe(true);
  });

  it('passes framing from a running reading', () => {
    expect(framingPassed({ hasSensor: true, steadyMs: 800 }, 900)).toBe(true);
    expect(framingPassed({ hasSensor: true, steadyMs: 200 }, 900)).toBe(false);
    expect(framingPassed({ hasSensor: false, steadyMs: 0 }, 1300)).toBe(true);
    expect(framingPassed({ hasSensor: true, steadyMs: 0 }, FRAMING_GIVE_UP_MS)).toBe(true);
  });

  it('measures shake between samples', () => {
    expect(shakiness([upright])).toBe(0);
    expect(shakiness([upright, upright, upright])).toBe(0);
    expect(shakiness([upright, { x: 0.1, y: -1, z: 0 }])).toBeCloseTo(0.1);
  });

  it('gives simple photo feedback in priority order', () => {
    const base = { kind: 'front' as const, roll: 0, pitch: 0, shake: 0, steadyMs: 800, wasLevel: true, tip: KIND_HINT.front, hasSensor: true };
    expect(shotFeedback(base)).toEqual({ good: true, text: 'Perfect, hold still' });
    expect(shotFeedback({ ...base, shake: 1 }).text).toBe('Hold still');
    expect(shotFeedback({ ...base, roll: 12 }).text).toBe('Hold the phone straight');
    expect(shotFeedback({ ...base, pitch: 50 }).text).toBe('Hold the phone upright');
    expect(shotFeedback({ ...base, kind: 'object', pitch: 50 }).good).toBe(true); // close-ups may point down
    expect(shotFeedback({ ...base, steadyMs: 100 }).text).toBe('Step back a little');
    expect(shotFeedback({ ...base, hasSensor: false, steadyMs: 100 }).good).toBe(false);
  });

  it('maps the mic meter and the clock', () => {
    expect(meterLevel(-160)).toBe(0);
    expect(meterLevel(0)).toBe(1);
    expect(meterLevel(undefined)).toBe(0);
    expect(meterBars(0).every((b) => b === 0.2)).toBe(true);
    expect(Math.max(...meterBars(1))).toBe(1);
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(352)).toBe('5:52');
  });
});

describe('capture content', () => {
  it('has ten questions in English and Tagalog plus the extra (backend index 10)', () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(10);
    INTERVIEW_QUESTIONS.forEach((q) => {
      expect(q.en.length).toBeGreaterThan(5);
      expect(q.tl.length).toBeGreaterThan(5);
    });
    expect(EXTRA_QUESTION_INDEX).toBe(10);
    expect(questionAt(0, 'en')).toBe("What's your shop called?");
    expect(questionAt(10, 'tl')).toBe('May iba pa?');
    expect(CAM_LABELS.en.next).toBe('Next question');
    expect(CAM_LABELS.en.finish).toBe('Finish');
  });

  it('has ten short photo tasks for every kind of shop', () => {
    Object.values(SHOT_LISTS).forEach((list) => {
      expect(list).toHaveLength(10);
      list.forEach((t) => {
        expect(t.t.split(' ').length).toBeLessThanOrEqual(4);
        expect(KIND_HINT[t.kind]).toBeTruthy();
      });
    });
    expect(shotList('nope')).toBe(SHOT_LISTS.shop);
  });

  it('picks the agent shot list from the business type', () => {
    expect(shotListKeyForBusinessType('Barber/Salon')).toBe('barber');
    expect(shotListKeyForBusinessType('Spa/Massage')).toBe('salon');
    expect(shotListKeyForBusinessType('Auto Shop')).toBe('repair');
    expect(shotListKeyForBusinessType('Craft/Producer')).toBe('craft');
    expect(shotListKeyForBusinessType('Restaurant')).toBe('food');
    expect(shotListKeyForBusinessType('Law Office')).toBe('shop');
    expect(shotListKeyForBusinessType(undefined)).toBe('shop');
  });
});
