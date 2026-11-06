import { EMAIL_BRAND_BUDDY, EMAIL_BRAND_MARK, emailActions, emailButton, emailDetails, emailFeature, emailFrame, emailSchedule, emailStatus, emailSteps } from '@/lib/email/design'
import { load } from 'cheerio'

describe('Tendso email frame', () => {
    it('escapes plain text and keeps intentionally rich body content intact', () => {
        const html = emailFrame({
            title: 'Shop <script>bad()</script>', heading: 'Hi <img src=x onerror=bad()>',
            eyebrow: '<b>Receipt</b>', preheader: 'A & B <paid>',
            bodyHtml: '<p>Your <strong>receipt</strong> is ready.</p>',
            supportEmail: 'help@example.com" onclick="bad()',
        })
        const $ = load(html)
        expect($('script,[onclick],[onerror]')).toHaveLength(0)
        expect($('img').map((_, image) => $(image).attr('src')).get()).toEqual([EMAIL_BRAND_MARK])
        expect($('h1').text()).toBe('Hi <img src=x onerror=bad()>')
        expect($('title').text()).toBe('Shop <script>bad()</script>')
        expect($('strong').text()).toBe('receipt')
        expect($('a').attr('href')).toBe('mailto:help@example.com" onclick="bad()')
        expect($('body').attr('style')).toContain('background:#FFFFFF')
    })

    it('escapes personalized hero fields and protects its action URLs', () => {
        const attack = '<img src=x onerror=bad()>'
        const $ = load(emailFrame({
            title: 'Your preview', heading: 'Your site is ready', bodyHtml: '',
            recipientName: attack, status: attack, friendly: true,
            introHtml: '<p>A trusted introduction</p>',
            heroHtml: emailFeature({ label: 'Business', value: attack, tone: 'white' }),
            heroActions: [{ href: 'javascript:bad()', label: attack, primary: true }],
        }))
        expect($('script,[onerror]')).toHaveLength(0)
        expect($('img').map((_, image) => $(image).attr('src')).get()).toEqual([EMAIL_BRAND_MARK, EMAIL_BRAND_BUDDY])
        expect($.text()).toContain(`For ${attack}`)
        expect($.text()).toContain('A trusted introduction')
        expect($('a').first().attr('href')).toBe('#')
        expect($('a').first().text()).toBe(attack)
    })

    it('preserves signed URL query parameters without creating attributes', () => {
        const url = 'https://example.com/manage?t=a&action=cancel&name="Sam"'
        const $ = load(emailButton(url, 'Open <my> page'))
        expect($('a').attr('href')).toBe(url)
        expect($('a').text()).toBe('Open <my> page')
        expect($('[onclick],my')).toHaveLength(0)
    })

    it.each(['javascript:alert(1)', 'data:text/html,bad', 'vbscript:bad'])('rejects an executable action URL: %s', href => {
        expect(load(emailButton(href, 'Open'))('a').attr('href')).toBe('#')
    })

    it('escapes labels while allowing trusted detail values', () => {
        const $ = load(emailDetails([{ label: '<img src=x>', valueHtml: '<strong>₱3,499</strong>' }]) + emailStatus('<script>paid</script>', 'success'))
        expect($('img,script')).toHaveLength(0)
        expect($('strong').text()).toBe('₱3,499')
        expect($.text()).toContain('<img src=x>')
        expect($.text()).toContain('<script>paid</script>')
    })

    it('keeps feature, schedule and progress text escaped in their own compositions', () => {
        const attack = '<img src=x onerror=bad()>'
        const $ = load(emailFeature({ label: attack, value: attack, size: 'medium', detailHtml: '<strong>Verified detail</strong>' })
            + emailSchedule({ day: attack, time: attack, timezone: attack, duration: attack })
            + emailSteps([{ label: attack, state: 'done' }, { label: 'Review', state: 'current' }, { label: 'Live', state: 'upcoming' }]))
        expect($('img,[onerror]')).toHaveLength(0)
        expect($.text()).toContain(attack)
        expect($('strong').text()).toBe('Verified detail')
        expect($.text()).toContain('Review')
        expect($.text()).toContain('Live')
    })

    it('preserves signed management actions while rejecting executable URLs', () => {
        const url = 'https://example.com/manage?t=signed&action=cancel'
        const $ = load(emailActions([{ href: url, label: 'Cancel <call>' }, { href: 'javascript:bad()', label: 'Join', primary: true }]))
        expect($('a').map((_, e) => $(e).attr('href')).get()).toEqual([url, '#'])
        expect($('a').first().text()).toBe('Cancel <call>')
        expect($('call')).toHaveLength(0)
    })
})
