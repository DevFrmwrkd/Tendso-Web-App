import { createElement, type FormEvent, type MouseEvent, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { isAdminPreviewHref, type AdminPreviewRole } from '@/lib/admin-preview-navigation';
import { PreviewGuard } from '@/app/admin/preview/_components/PreviewGuard';

jest.mock('sonner', () => ({ toast: { info: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

describe('admin preview navigation boundary', () => {
    it.each(['affiliate', 'creator'] as const)('allows only the %s preview, local anchors and fixed read-only destinations', role => {
        const base = `/admin/preview/${role}`;
        for (const href of ['#', '#top', '#pt-shops', base, `${base}/`, `${base}?section=my-page`, `${base}?section=wallet#history`, '/v2/help', '/v2/privacy', '/v2/creators#rules']) {
            expect(isAdminPreviewHref(href, role)).toBe(true);
        }
    });

    it.each(['affiliate', 'creator'] as const)('rejects account routes, external links, malformed paths and lookalikes in %s', role => {
        const other = role === 'affiliate' ? 'creator' : 'affiliate';
        const base = `/admin/preview/${role}`;
        for (const href of [undefined, null, '', ' ', `${base} `, ` ${base}`, `${base}\n`, `${base}\u0000`,
            `https://www.tendso.com${base}`, `https://preview.tendso.invalid${base}`, `//evil.example${base}`, 'javascript:alert(1)', 'data:text/html,test',
            '/wallet', '/dashboard', '/affiliates/dashboard/my-page', '/v2/creators/portal', '/v2/creators/portal/my-page',
            `/admin/preview/${other}`, `${base}-forged`, `${base}/wallet`, `${base}/../${role}`, `${base}/%2e%2e/${role}`, `${base}/./`,
            `${base}\\..\\${role}`, `${base}/%`, '/v2/help?next=https://evil.example', '/v2/creators', '/v2/creators#apply']) {
            expect(isAdminPreviewHref(href, role)).toBe(false);
        }
    });
});

type GuardHandlers = {
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
    onAuxClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
    onSubmitCapture: (event: FormEvent<HTMLDivElement>) => void;
};

function guardHandlers(role: AdminPreviewRole): GuardHandlers {
    let tree: ReactElement<GuardHandlers> | undefined;
    function Capture() {
        tree = PreviewGuard({ role, children: createElement('span', {}, 'Local preview') });
        return tree;
    }
    renderToStaticMarkup(createElement(Capture));
    return tree!.props;
}

function click(href: string | null, extra: Partial<MouseEvent<HTMLDivElement>> = {}) {
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
    const target = { closest: () => href === null ? null : { getAttribute: () => href } };
    return { target, preventDefault, stopPropagation, ...extra } as unknown as MouseEvent<HTMLDivElement>;
}

describe('admin preview capture guard', () => {
    it('explains field-agent actions that have no sample section instead of leaving an inert hash', () => {
        const event = click('/admin/preview/creator#submit-info');
        guardHandlers('creator').onClickCapture(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledTimes(1);
    });
    it.each(['onClickCapture', 'onAuxClickCapture'] as const)('blocks a live destination on %s before the child action runs', handler => {
        const event = click('/v2/creators/portal/my-page', { button: handler === 'onAuxClickCapture' ? 1 : 0, ctrlKey: true });
        guardHandlers('affiliate')[handler](event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledTimes(1);
    });

    it.each(['onClickCapture', 'onAuxClickCapture'] as const)('preserves local sample navigation and its native modifier behavior on %s', handler => {
        const event = click('/admin/preview/affiliate?section=my-page', { ctrlKey: true, metaKey: true, button: 1 });
        guardHandlers('affiliate')[handler](event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it('does not interfere with local tabs, disclosure buttons or page-editor controls', () => {
        const event = click(null);
        guardHandlers('creator').onClickCapture(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it('prevents forms from saving to any account before child submit handlers can run', () => {
        const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as FormEvent<HTMLDivElement>;
        guardHandlers('affiliate').onSubmitCapture(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledTimes(1);
    });

    it('allows only the affiliate editor’s explicitly marked local preview save', () => {
        const form = { tagName: 'FORM', getAttribute: (name: string) => name === 'data-preview-local-save' ? 'true' : null };
        const event = { target: form, preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as FormEvent<HTMLDivElement>;
        guardHandlers('affiliate').onSubmitCapture(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
        guardHandlers('creator').onSubmitCapture(event);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    });
});
