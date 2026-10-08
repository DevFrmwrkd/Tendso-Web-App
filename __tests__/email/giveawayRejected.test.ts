jest.mock('@/lib/payment/config', () => ({ getPaymentConfig: () => ({ wiseEmail: 'team@tendso.com' }) }));
import { getGiveawayRejectedEmailHtml } from '@/lib/email/templates';

const params = {
    businessName: 'Corner Salon', businessOwnerName: 'Sam',
    reason: 'The poster is not visible. Please take another photo with your shop sign.',
    applyUrl: 'https://tendso.com/100-pages-giveaway',
};

describe('giveaway rejection email', () => {
    it('gives the plain reason and explains slot release and reapplication while slots remain', () => {
        const html = getGiveawayRejectedEmailHtml(params);
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        expect(text).toContain(params.reason);
        expect(text).toContain('Your held slot has been released.');
        expect(text).toContain('fix the issue above and apply again while slots remain.');
        expect(html).toContain(`href="${params.applyUrl}"`);
        expect(text).not.toMatch(/payment instructions|payable|GCash|Maya|₱4,999|discount/i);
    });
    it('escapes names, reason, and URL rather than allowing owner or reviewer markup', () => {
        const html = getGiveawayRejectedEmailHtml({ ...params, businessName: '<img src=x>', businessOwnerName: '<script>x</script>',
            reason: '<a href="https://fake.example">click</a>\nPoster & sign', applyUrl: 'https://tendso.com/100-pages-giveaway?a="x"&src=poster' });
        expect(html).toContain('&lt;img src=x&gt;');
        expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
        expect(html).toContain('&lt;a href=&quot;https://fake.example&quot;&gt;click&lt;/a&gt;');
        expect(html).toContain('Poster &amp; sign');
        expect(html).toContain('?a=&quot;x&quot;&amp;src=poster');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img src=x>');
    });
});
