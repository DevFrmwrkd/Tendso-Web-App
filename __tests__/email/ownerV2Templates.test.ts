import { OWNER_V2_TAGLINE, ownerBuildingEmail, ownerInviteEmail, ownerPreviewReadyEmail, ownerSiteLiveEmail } from '@/lib/email/ownerV2Templates';

const owner = { ownerName: 'Mika Santos', businessName: 'Corner Shop', appUrl: 'https://tendso.com/my-business?site=shop&from=email' };

describe('owner emails in the shared Tendso frame', () => {
    it('preserves the invitation subject, sign-in method and destination', () => {
        const email = ownerInviteEmail({ ...owner, email: 'mika@example.com' });
        expect(email.subject).toBe('Your website for Corner Shop');
        expect(email.html).toContain('class="t-email-heading"');
        expect(email.html).toContain('Your business is on Tendso');
        expect(email.html).toContain('mika@example.com');
        expect(email.html).toContain('We send you a code. No password.');
        expect(email.html).toContain('href="https://tendso.com/my-business?site=shop&amp;from=email"');
        expect(email.text).toContain(owner.appUrl);
        expect(email.html).not.toContain('&amp;amp;');
    });

    it('keeps build and preview notices distinct from a published site', () => {
        const building = ownerBuildingEmail(owner);
        expect(building.subject).toBe("We're building Corner Shop's website");
        expect(building.html).toContain('We are building your site');
        expect(building.text).toContain('about 20 minutes');
        expect(building.text).toContain(OWNER_V2_TAGLINE);
        const preview = ownerPreviewReadyEmail({ ...owner, priceText: '₱4,999' });
        expect(preview.subject).toBe('Corner Shop: your site is ready to check');
        expect(preview.html).toContain('Only you can see it.');
        expect(preview.html).toContain('Looks good');
        expect(preview.html).toContain('Private preview');
        expect(preview.html).toContain('Your review');
        expect(preview.html.indexOf('>See my site</a>')).toBeLessThan(preview.html.indexOf('One-time website price'));
        expect(preview.html).not.toContain('Your site is live');
        expect(preview.text).toContain('₱4,999, once.');
        expect(preview.text).toContain('payment options available at checkout');
    });

    it.each([undefined, null, '', '₱3,000'])('shows a remaining balance only when provided (%s)', balanceText => {
        const email = ownerSiteLiveEmail({ ...owner, websiteUrl: 'https://corner.sites.tendso.com', balanceText });
        expect(email.subject).toBe('Corner Shop is live');
        expect(email.html).toContain('href="https://corner.sites.tendso.com"');
        expect(email.html.includes('Balance left to pay:')).toBe(Boolean(balanceText));
        expect(email.text.includes('Balance left to pay:')).toBe(Boolean(balanceText));
        if (balanceText) expect(email.html).toContain(balanceText);
    });

    it('escapes runtime names, prices, email addresses and links exactly once', () => {
        const malicious = { ownerName: '<script>bad</script>', businessName: '<img src=x> & Shop', appUrl: 'https://tendso.com/my-business?a="x"&b=1' };
        const emails = [
            ownerInviteEmail({ ...malicious, email: '<script>@example.com' }),
            ownerBuildingEmail(malicious),
            ownerPreviewReadyEmail({ ...malicious, priceText: '<b>free</b>' }),
            ownerSiteLiveEmail({ ...malicious, websiteUrl: malicious.appUrl, balanceText: '<b>unpaid</b>' }),
        ];
        for (const email of emails) {
            expect(email.html).toContain('&lt;script&gt;bad&lt;/script&gt;');
            expect(email.html).toContain('&lt;img src=x&gt; &amp; Shop');
            expect(email.html).toContain('?a=&quot;x&quot;&amp;b=1');
            expect(email.html).not.toContain('<script>');
            expect(email.html).not.toContain('<img src=x>');
            expect(email.html).not.toContain('&amp;lt;');
        }
        expect(emails[2].html).toContain('&lt;b&gt;free&lt;/b&gt;');
        expect(emails[3].html).toContain('&lt;b&gt;unpaid&lt;/b&gt;');
    });
});
