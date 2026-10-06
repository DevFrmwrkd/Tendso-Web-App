import { containerType, pickRecordingType, recordingFileName } from '@/app/submit/_components/flow';

/**
 * Which format the interview step records in: one the phone can play back,
 * so the creator can watch what they recorded. Recording was fixed to WebM
 * VP9, which an iPhone may record or not but cannot be relied on to play.
 */

const startsWithAny = (...prefixes: string[]) => (type: string) => prefixes.some((p) => type.startsWith(p));

describe('pickRecordingType', () => {
    it('records WebM (VP8) where it plays: Chrome, Android', () => {
        const chrome = startsWithAny('video/webm', 'video/mp4', 'audio/webm', 'audio/mp4');
        expect(pickRecordingType('video', chrome, chrome)).toBe('video/webm;codecs=vp8,opus');
        expect(pickRecordingType('audio', chrome, chrome)).toBe('audio/webm;codecs=opus');
    });

    it('records MP4 on a phone that can record WebM but not play it back', () => {
        const canRecord = startsWithAny('video/webm', 'video/mp4');
        const canPlay = startsWithAny('video/mp4');
        expect(pickRecordingType('video', canRecord, canPlay)).toBe('video/mp4;codecs=avc1,mp4a.40.2');
    });

    it('records MP4 on an iPhone that records nothing else', () => {
        const iphone = (type: string) => type === 'video/mp4' || type === 'audio/mp4';
        expect(pickRecordingType('video', iphone, iphone)).toBe('video/mp4');
        expect(pickRecordingType('audio', iphone, iphone)).toBe('audio/mp4');
    });

    it('asks about playback by container', () => {
        const asked: string[] = [];
        pickRecordingType('video', () => true, (container) => {
            asked.push(container);
            return true;
        });
        expect(asked).toEqual(['video/webm']);
    });

    it('falls back to anything it can record, then to the browser’s own pick', () => {
        expect(pickRecordingType('video', startsWithAny('video/webm'), () => false)).toBe('video/webm;codecs=vp8,opus');
        expect(pickRecordingType('video', () => false, () => true)).toBeUndefined();
    });
});

describe('recording file names and types', () => {
    it('files a recording under its container', () => {
        expect(containerType('video/webm;codecs=vp8,opus')).toBe('video/webm');
        expect(containerType('Video/MP4; codecs="avc1"')).toBe('video/mp4');
    });

    it('names the file by what was recorded', () => {
        expect(recordingFileName('video/webm;codecs=vp8,opus')).toBe('interview.webm');
        expect(recordingFileName('video/mp4')).toBe('interview.mp4');
        expect(recordingFileName('audio/mp4')).toBe('interview.m4a');
        expect(recordingFileName('audio/webm')).toBe('interview.webm');
        expect(recordingFileName('audio/ogg;codecs=opus')).toBe('interview.ogg');
    });
});
