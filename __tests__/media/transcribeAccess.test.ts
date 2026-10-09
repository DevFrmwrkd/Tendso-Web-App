jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('convex/browser', () => ({ ConvexHttpClient: jest.fn() }));
jest.mock('@/lib/services/groq.service', () => ({ groqService: { transcribeAudioFromUrl: jest.fn() } }));
jest.mock('@/lib/security', () => ({ checkRateLimit: jest.fn(), RATE_LIMITS: { expensive: { maxRequests: 5, windowMs: 60000 } } }));
jest.mock('@/convex/_generated/api', () => ({ api: {
    adminAccess: { me: 'session' },
    submissions: { getById: 'submission', update: 'update', recordTranscriptionFromServer: 'serverTranscript' },
    files: { getUrlByString: 'storageUrl' },
} }));

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { groqService } from '@/lib/services/groq.service';
import { checkRateLimit } from '@/lib/security';
import { POST } from '@/app/api/transcribe/route';

type ClientMock = { setAuth: jest.Mock; query: jest.Mock; mutation: jest.Mock };
const authMock = auth as unknown as jest.Mock;
const clientConstructor = ConvexHttpClient as unknown as jest.Mock;
const transcribe = groqService.transcribeAudioFromUrl as jest.Mock;
const getToken = jest.fn();
const originalSecret = process.env.INTERNAL_API_SECRET;
const mediaUrl = 'https://media.example.test/audio/interview.webm';
let actor: { _id: string; role?: string; status?: string; isDeleted?: boolean } | null;
let submission: { creatorId: string; audioUrl?: string } | null;
let clients: ClientMock[];
let network: jest.SpyInstance;

function request(body: unknown = { submissionId: 'submission-1', audioUrl: mediaUrl }, secret?: string) {
    return new NextRequest('https://tendso.com/api/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Internal-Secret': secret } : {}) },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
    actor = { _id: 'creator-1', role: 'creator', status: 'active' };
    submission = { creatorId: 'creator-1', audioUrl: mediaUrl };
    clients = [];
    getToken.mockResolvedValue('verified-creator-token');
    authMock.mockResolvedValue({ userId: 'creator-session', getToken });
    clientConstructor.mockImplementation(() => {
        const client: ClientMock = { setAuth: jest.fn(), query: jest.fn(), mutation: jest.fn().mockResolvedValue(undefined) };
        client.query.mockImplementation(async (query: string) => query === 'session'
            ? { clerkId: 'creator-session', creator: actor, isOwner: actor === null }
            : query === 'submission' ? submission : mediaUrl);
        clients.push(client);
        return client;
    });
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
    transcribe.mockResolvedValue('The owner tells their story.');
    network = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { headers: { 'content-length': '1024' } }));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => { jest.restoreAllMocks(); });
afterAll(() => {
    if (originalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = originalSecret;
});

function expectNoSideEffects() {
    expect(network).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();
    for (const client of clients) expect(client.mutation).not.toHaveBeenCalled();
}

describe('transcription caller authorization', () => {
    it('requires both a Clerk login and Convex token before constructing a client or doing work', async () => {
        authMock.mockResolvedValueOnce({ userId: null });
        expect((await POST(request())).status).toBe(401);
        getToken.mockResolvedValueOnce(null);
        expect((await POST(request())).status).toBe(401);
        expect(clientConstructor).not.toHaveBeenCalled();
        expectNoSideEffects();
    });

    it.each([
        { _id: 'creator-1', role: 'affiliate' }, { _id: 'creator-1', role: 'staff' }, null,
        { _id: 'creator-1', role: 'creator', status: 'suspended' },
        { _id: 'creator-1', role: 'creator', status: 'deleted' },
        { _id: 'creator-1', role: 'creator', isDeleted: true },
        { _id: 'creator-1', role: 'admin', status: 'suspended' },
        { _id: 'creator-1', role: 'admin', isDeleted: true },
    ])('rejects this account before fetching media or writing a status: %j', async (account) => {
        actor = account;
        expect((await POST(request())).status).toBe(403);
        expect(clients[0].query).toHaveBeenCalledTimes(1);
        expectNoSideEffects();
    });

    it('rejects a verified Convex session that belongs to another Clerk subject', async () => {
        authMock.mockResolvedValueOnce({ userId: 'another-session', getToken });
        expect((await POST(request())).status).toBe(403);
        expectNoSideEffects();
    });

    it('rejects a cross-owner submission without even marking it failed', async () => {
        submission = { creatorId: 'another-creator', audioUrl: mediaUrl };
        expect((await POST(request())).status).toBe(403);
        expect(clients[0].query).toHaveBeenCalledWith('submission', { id: 'submission-1' });
        expect(checkRateLimit).not.toHaveBeenCalled();
        expectNoSideEffects();
    });

    it('rejects a nonexistent submission before any external work', async () => {
        submission = null;
        expect((await POST(request())).status).toBe(404);
        expectNoSideEffects();
    });

    it.each([null, 123, ''])('rejects a malformed submission id (%j) without work', async (submissionId) => {
        expect((await POST(request({ submissionId, audioUrl: mediaUrl }))).status).toBe(400);
        expectNoSideEffects();
    });

    it('forwards a legitimate creator token and saves the same transcript response', async () => {
        const response = await POST(request());
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, transcript: 'The owner tells their story.' });
        expect(getToken).toHaveBeenCalledWith({ template: 'convex' });
        expect(clients[0].setAuth).toHaveBeenCalledWith('verified-creator-token');
        expect(clients[0].query).toHaveBeenNthCalledWith(1, 'session', {});
        expect(clients[0].mutation).toHaveBeenNthCalledWith(1, 'update', { id: 'submission-1', transcriptionStatus: 'processing' });
        expect(clients[0].mutation).toHaveBeenNthCalledWith(2, 'update', {
            id: 'submission-1', transcript: 'The owner tells their story.', transcriptionStatus: 'complete', transcriptionUpdatedAt: expect.any(Number),
        });
        expect(transcribe).toHaveBeenCalledWith(mediaUrl);
    });

    it('allows an active admin to transcribe another account submission with their own token', async () => {
        actor = { _id: 'admin-1', role: 'admin', status: 'active' };
        getToken.mockResolvedValue('verified-admin-token');
        expect((await POST(request())).status).toBe(200);
        expect(clients[0].setAuth).toHaveBeenCalledWith('verified-admin-token');
        expect(clients[0].mutation).toHaveBeenCalledWith('update', expect.objectContaining({ id: 'submission-1', transcriptionStatus: 'complete' }));
    });

    it('preserves legacy creator accounts and transcript-only requests without an attached submission', async () => {
        actor = { _id: 'creator-1' };
        const response = await POST(request({ audioUrl: mediaUrl }));
        expect(await response.json()).toEqual({ success: true, transcript: 'The owner tells their story.' });
        expect(clients[0].mutation).not.toHaveBeenCalled();
    });

    it('uses saved media when the caller has not received the new uploaded URL yet', async () => {
        expect((await POST(request({ submissionId: 'submission-1' }))).status).toBe(200);
        expect(transcribe).toHaveBeenCalledWith(mediaUrl);
    });

    it('does not contact Groq if the backend revokes access before the processing write', async () => {
        clientConstructor.mockImplementationOnce(() => {
            const client = { setAuth: jest.fn(), query: jest.fn(), mutation: jest.fn().mockRejectedValue(new Error('Forbidden: account access required')) };
            client.query.mockImplementation(async (query: string) => query === 'session'
                ? { clerkId: 'creator-session', creator: actor } : submission);
            clients.push(client);
            return client;
        });
        expect((await POST(request())).status).toBe(500);
        expect(network).not.toHaveBeenCalled();
        expect(transcribe).not.toHaveBeenCalled();
    });

    it('never records failure when access lookup itself fails', async () => {
        clientConstructor.mockImplementationOnce(() => {
            const client = { setAuth: jest.fn(), query: jest.fn().mockRejectedValue(new Error('Token expired')), mutation: jest.fn() };
            clients.push(client);
            return client;
        });
        expect((await POST(request())).status).toBe(500);
        expectNoSideEffects();
    });
});

describe('internal transcription bridge and request isolation', () => {
    it('uses only the narrow secret-protected mutation without Clerk or a user JWT', async () => {
        const response = await POST(request(undefined, 'test-internal-secret'));
        expect(response.status).toBe(200);
        expect(authMock).not.toHaveBeenCalled();
        expect(clients[0].setAuth).not.toHaveBeenCalled();
        expect(checkRateLimit).not.toHaveBeenCalled();
        expect(clients[0].query).not.toHaveBeenCalledWith('session', expect.anything());
        expect(clients[0].mutation).toHaveBeenNthCalledWith(1, 'serverTranscript', {
            id: 'submission-1', internalSecret: 'test-internal-secret', transcriptionStatus: 'processing',
        });
        expect(clients[0].mutation).toHaveBeenNthCalledWith(2, 'serverTranscript', {
            id: 'submission-1', internalSecret: 'test-internal-secret', transcript: 'The owner tells their story.',
            transcriptionStatus: 'complete', transcriptionUpdatedAt: expect.any(Number),
        });
        expect(clients[0].mutation.mock.calls.every(([method]) => method === 'serverTranscript')).toBe(true);
    });

    it.each(['wrong-secret', undefined])('does not treat a missing or invalid secret as an internal call (%j)', async (secret) => {
        authMock.mockResolvedValueOnce({ userId: null });
        expect((await POST(request(undefined, secret))).status).toBe(401);
        expect(clientConstructor).not.toHaveBeenCalled();
        expectNoSideEffects();
    });

    it('requires a configured server secret before accepting the internal header', async () => {
        delete process.env.INTERNAL_API_SECRET;
        authMock.mockResolvedValueOnce({ userId: null });
        expect((await POST(request(undefined, 'test-internal-secret'))).status).toBe(401);
        expectNoSideEffects();
    });

    it.each(['user', 'internal'])('records an external transcription failure through the authorized %s path only', async (mode) => {
        transcribe.mockRejectedValueOnce(new Error('Timeout from provider'));
        const response = await POST(request(undefined, mode === 'internal' ? 'test-internal-secret' : undefined));
        expect(response.status).toBe(504);
        expect(clients[0].mutation).toHaveBeenLastCalledWith(mode === 'internal' ? 'serverTranscript' : 'update', {
            id: 'submission-1', transcriptionStatus: 'failed', ...(mode === 'internal' ? { internalSecret: 'test-internal-secret' } : {}),
        });
    });

    it('creates distinct authenticated clients for concurrent requests so tokens cannot leak between users', async () => {
        authMock.mockResolvedValueOnce({ userId: 'session-a', getToken: jest.fn().mockResolvedValue('token-a') })
            .mockResolvedValueOnce({ userId: 'session-b', getToken: jest.fn().mockResolvedValue('token-b') });
        clientConstructor.mockImplementation(() => {
            let token: string;
            const client: ClientMock = { setAuth: jest.fn((value: string) => { token = value; }), query: jest.fn(), mutation: jest.fn().mockResolvedValue(undefined) };
            client.query.mockImplementation(async (query: string) => {
                const suffix = token === 'token-a' ? 'a' : 'b';
                return query === 'session' ? { clerkId: `session-${suffix}`, creator: { _id: `creator-${suffix}`, role: 'creator' } }
                    : { creatorId: `creator-${suffix}`, audioUrl: mediaUrl };
            });
            clients.push(client);
            return client;
        });
        const responses = await Promise.all([
            POST(request({ submissionId: 'submission-a', audioUrl: mediaUrl })),
            POST(request({ submissionId: 'submission-b', audioUrl: mediaUrl })),
        ]);
        expect(responses.map((response) => response.status)).toEqual([200, 200]);
        expect(clientConstructor).toHaveBeenCalledTimes(2);
        expect(clients[0]).not.toBe(clients[1]);
        for (const [index, suffix] of ['a', 'b'].entries()) {
            expect(clients[index].setAuth).toHaveBeenCalledTimes(1);
            expect(clients[index].setAuth).toHaveBeenCalledWith(`token-${suffix}`);
            expect(clients[index].mutation.mock.calls.every(([, args]) => args.id === `submission-${suffix}`)).toBe(true);
        }
    });
});
