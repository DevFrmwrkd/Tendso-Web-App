import { sendAsTendso, TENDSO_ADDRESS } from '@/convex/lib/tendsoGoogle';

describe('booking email transport', () => {
    const originalFetch = global.fetch;
    const originalKey = process.env.RESEND_API_KEY;
    const fetchMock = jest.fn();

    beforeEach(() => {
        process.env.RESEND_API_KEY = 'test-resend-key';
        global.fetch = fetchMock;
        fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 'booking-email-1' }) });
    });
    afterAll(() => {
        global.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = originalKey;
    });

    it('sends the real HTML and text from Support without using Google mail credentials', async () => {
        const message = { to: 'candidate@example.test', subject: 'Your call, Tuñacao', text: 'Your call is booked.', html: '<p>Your call is booked.</p>' };
        await expect(sendAsTendso(message)).resolves.toEqual({ id: 'booking-email-1' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, request] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.resend.com/emails');
        expect(request.method).toBe('POST');
        expect(request.headers).toEqual({ Authorization: 'Bearer test-resend-key', 'Content-Type': 'application/json' });
        expect(JSON.parse(request.body)).toEqual({
            from: 'Tendso <support@tendso.com>', to: [message.to], reply_to: 'support@tendso.com',
            subject: message.subject, text: message.text, html: message.html,
        });
        expect(request.body).not.toContain('tendso.hr@gmail.com');
        expect(TENDSO_ADDRESS).toBe('tendso.hr@gmail.com');
    });

    it('keeps reply-thread headers when one is provided', async () => {
        await sendAsTendso({ to: 'candidate@example.test', subject: 'Re: Your call', text: 'Confirmed.', inReplyTo: '<previous@example.test>' });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).headers).toEqual({
            'In-Reply-To': '<previous@example.test>', References: '<previous@example.test>',
        });
    });

    it('renders plain-text-only messages safely while preserving their text part', async () => {
        const text = 'Hi <Pablo> & team\nYour call is booked.';
        await sendAsTendso({ to: 'candidate@example.test', subject: 'Your call', text });
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.text).toBe(text);
        expect(body.html).toBe('Hi &lt;Pablo&gt; &amp; team<br>Your call is booked.');
    });

    it('fails without a configured key instead of falling back to the Gmail sender', async () => {
        delete process.env.RESEND_API_KEY;
        await expect(sendAsTendso({ to: 'candidate@example.test', subject: 'Your call', text: 'Booked.' })).rejects.toThrow('RESEND_API_KEY');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('propagates provider failures so reminders can release their claim and retry', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 429 });
        await expect(sendAsTendso({ to: 'candidate@example.test', subject: 'Your call', text: 'Booked.' })).rejects.toThrow('Resend 429');
    });

    it('does not mark an incomplete provider response as a successful send', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
        await expect(sendAsTendso({ to: 'candidate@example.test', subject: 'Your call', text: 'Booked.' })).rejects.toThrow('message id');
    });
});
