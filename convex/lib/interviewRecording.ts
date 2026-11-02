export type InterviewRecording = {
    videoStorageId?: string | null;
    audioStorageId?: string | null;
    videoUrl?: string | null;
    audioUrl?: string | null;
};

/** Bind an asynchronous transcript to the exact recording it was started for. */
export function interviewRecordingFingerprint(recording: InterviewRecording): string {
    return JSON.stringify([
        recording.videoStorageId ?? null,
        recording.audioStorageId ?? null,
        recording.videoUrl ?? null,
        recording.audioUrl ?? null,
    ]);
}

export function interviewRecordingSources(recording: InterviewRecording): string[] {
    return [recording.videoStorageId, recording.audioStorageId, recording.videoUrl, recording.audioUrl]
        .filter((source): source is string => typeof source === 'string' && source.length > 0);
}
