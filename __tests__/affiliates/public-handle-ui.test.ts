import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatorCard } from '../../lib/v2/creatorTypes';
import { CREATOR_CODE_PRICE } from '../../lib/pricing';

const state = vi.hoisted(() => ({ live: undefined as CreatorCard | null | undefined, queries: [] as { name: string; args: unknown }[] }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ isLoaded: true }) }));
vi.mock('convex/react', () => ({
    useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
        state.queries.push({ name: getFunctionName(reference), args });
        return state.live;
    },
}));
import { useCreatorCard } from '../../lib/v2/creatorData';

function PublicCard() {
    const card = useCreatorCard('maria');
    return createElement('p', {}, card.status === 'found' ? `${card.card.name}: ${card.card.price}` : card.status);
}
beforeEach(() => { state.queries = []; state.live = undefined; });

describe('public handle card hook', () => {
    it('queries the handle namespace and renders the existing affiliate returned by the server', () => {
        state.live = { handle: 'maria', code: 'AFF123ABC', name: 'Maria', photo: null, listPrice: 4999, price: CREATOR_CODE_PRICE, saving: 1500, percentOff: 30 };
        expect(renderToStaticMarkup(createElement(PublicCard))).toContain('Maria: 3499');
        expect(state.queries).toEqual([{ name: 'creatorProgram:getCreatorByHandle', args: { handle: 'maria' } }]);
    });
    it('keeps the loading and unavailable states for unknown or suspended handles', () => {
        expect(renderToStaticMarkup(createElement(PublicCard))).toContain('loading');
        state.live = null;
        expect(renderToStaticMarkup(createElement(PublicCard))).toContain('missing');
    });
});
