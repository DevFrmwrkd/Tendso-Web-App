import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

jest.mock("@clerk/nextjs", () => ({ useAuth: jest.fn() }));
jest.mock("convex/react", () => ({ useConvex: jest.fn(), useConvexAuth: jest.fn(), useMutation: jest.fn(), useQuery: jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));
jest.mock("react", () => ({ ...jest.requireActual("react"), useCallback: (fn: unknown) => fn }));

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('creator portal historical month reads', () => {
    function read(month?: string, returnedMonth = '2026-10', authenticated = true) {
        const { useAuth } = jest.requireMock('@clerk/nextjs');
        const { useConvexAuth, useQuery } = jest.requireMock('convex/react');
        const { getFunctionName } = jest.requireActual('convex/server');
        useAuth.mockReturnValue({ isLoaded: true });
        useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: authenticated });
        useQuery.mockImplementation((ref: unknown) => getFunctionName(ref) === 'creatorProgram:myApplication'
            ? { status: 'active' } : { month: { label: returnedMonth } });
        let state: unknown;
        function Probe() {
            state = jest.requireActual('@/lib/v2/creatorData').usePortal({ month });
            return null;
        }
        renderToStaticMarkup(createElement(Probe));
        return { state, args: useQuery.mock.calls.filter(([ref]: [unknown]) => getFunctionName(ref) === 'creatorPortal:summary').at(-1)?.[1] };
    }

    beforeEach(() => jest.clearAllMocks());
    it('requests the chosen month and keeps the default current-month call compatible', () => {
        expect(read('2026-10')).toMatchObject({ args: { month: '2026-10' }, state: { status: 'ready' } });
        expect(read()).toMatchObject({ args: {}, state: { status: 'ready' } });
    });
    it('hides stale totals until the selected period arrives', () => {
        expect(read('2026-09')).toMatchObject({ state: { status: 'loading' } });
    });
    it('skips financial queries after sign-out', () => {
        expect(read('2026-10', '2026-10', false)).toMatchObject({ args: 'skip', state: { status: 'signed_out' } });
    });
});

describe("creator sample mode", () => {
    it.each([
        ["development", "1", true],
        ["development", "0", false],
        ["production", "1", false],
        ["production", "0", false],
        ["test", "1", false],
    ] as const)("in %s with flag %s, sample mode is %s", (environment, flag, enabled) => {
        jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: environment, NEXT_PUBLIC_V2_CREATORS_SAMPLE: flag });
        jest.isolateModules(() => {
            expect(jest.requireActual("@/lib/v2/creatorData").CREATORS_SAMPLE).toBe(enabled);
        });
    });

    it("keeps production reads and application writes live even with the sample flag enabled", async () => {
        jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_V2_CREATORS_SAMPLE: "1" });
        const apply = jest.fn().mockResolvedValue("application-id");
        const args = { handle: "mika", code: "MIKA" };
        let pending: Promise<void> | undefined;
        jest.isolateModules(() => {
            const { useQuery, useMutation } = jest.requireMock("convex/react");
            const { getFunctionName } = jest.requireActual("convex/server");
            useQuery.mockReturnValue(null);
            useMutation.mockReturnValue(apply);
            const { useCreatorCard, useApplyAsCreator } = jest.requireActual("@/lib/v2/creatorData");
            expect(useCreatorCard("mika")).toEqual({ status: "missing" });
            expect(useQuery.mock.calls[0][1]).toEqual({ handle: "mika" });
            expect(getFunctionName(useQuery.mock.calls[0][0])).toBe("creatorProgram:getCreatorByHandle");
            pending = useApplyAsCreator()(args);
            expect(getFunctionName(useMutation.mock.calls[0][0])).toBe("creatorProgram:apply");
        });
        await pending;
        expect(apply).toHaveBeenCalledWith(args);
    });
});

describe("creator store buttons", () => {
    it.each([undefined, null])("keeps released store links while settings are loading or missing (%s)", (setting) => {
        const { useQuery } = jest.requireMock("convex/react");
        useQuery.mockReturnValue(setting);
        const { StoreRow } = jest.requireActual("@/components/v2/creators/Stores");
        const html = renderToStaticMarkup(createElement(StoreRow));
        expect(html).toContain('href="https://apps.apple.com/ph/app/tendso/id6786666106"');
        expect(html).toContain('href="https://play.google.com/store/apps/details?id=com.negosyodigital.app"');
        expect(html).not.toContain("Coming soon");
    });

    it("links to configured listings", () => {
        const { useQuery } = jest.requireMock("convex/react");
        useQuery.mockImplementation((_reference: unknown, args: { key: string }) => args.key === "app_store_url"
            ? "https://apps.apple.com/ph/app/tendso/id123"
            : "https://play.google.com/store/apps/details?id=com.negosyodigital.app");
        const { StoreRow } = jest.requireActual("@/components/v2/creators/Stores");
        const html = renderToStaticMarkup(createElement(StoreRow));
        expect(html).toContain('href="https://apps.apple.com/ph/app/tendso/id123"');
        expect(html).toContain('href="https://play.google.com/store/apps/details?id=com.negosyodigital.app"');
        expect(html).not.toContain("Coming soon");
    });
});
