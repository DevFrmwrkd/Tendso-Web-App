import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import MapPicker, { listenForMapAuthFailure } from "@/app/start/MapPicker";

let mockApiStatus = "LOADED";
let mockMapProps: Record<string, unknown>;
jest.mock("@vis.gl/react-google-maps", () => ({
    APIProvider: ({ children }: { children: unknown }) => children,
    APILoadingStatus: {
        LOADED: "LOADED",
        FAILED: "FAILED",
        AUTH_FAILURE: "AUTH_FAILURE",
    },
    useApiLoadingStatus: () => mockApiStatus,
    Map: (props: Record<string, unknown>) => {
        mockMapProps = props;
        return createElement("div", { "data-testid": "google-map" });
    },
}));
jest.mock("@/lib/googleMaps", () => ({
    GOOGLE_MAPS_API_KEY: "sample-google-key",
}));

beforeEach(() => {
    mockApiStatus = "LOADED";
});

describe("owner map picker", () => {
    it("shows the detailed Google roadmap with businesses and landmarks enabled", () => {
        const onChange = jest.fn();
        const html = renderToStaticMarkup(
            createElement(MapPicker, {
                value: null,
                onChange,
                address: "Sample Street, Manila",
            }),
        );

        expect(mockMapProps.mapTypeId).toBe("roadmap");
        expect(mockMapProps.clickableIcons).toBe(true);
        expect(mockMapProps.styles).toBeUndefined();
        expect(mockMapProps.mapId).toBeUndefined();
        expect(html).toContain("Search an address or nearby landmark");
        expect(html).toContain("Find entered address");
        expect(html).toContain("Use my location");
        expect(html).toContain("Satellite");
        expect(html).toContain("Larger map");
        expect(html).toMatch(
            /<button[^>]*disabled=""[^>]*>Use this spot<\/button>/,
        );
        expect(onChange).not.toHaveBeenCalled();
    });

    it("preserves zero-valued confirmed coordinates and offers explicit change/remove/view actions", () => {
        const onChange = jest.fn();
        const html = renderToStaticMarkup(
            createElement(MapPicker, {
                value: { lat: 0, lng: 0 },
                onChange,
                address: "Sample address",
            }),
        );

        expect(mockMapProps.center).toEqual({ lat: 0, lng: 0 });
        expect(mockMapProps.controlled).toBe(true);
        expect(html).toContain("Shop pin saved");
        expect(html).toContain("Change location");
        expect(html).toContain("Remove pin");
        expect(html).toContain("query=0,0");
        expect(html).not.toContain("Search an address");
        expect(onChange).not.toHaveBeenCalled();
    });

    it.each(["FAILED", "AUTH_FAILURE"])(
        "keeps written-address intake usable when Google Maps reports %s",
        (status) => {
            mockApiStatus = status;
            const html = renderToStaticMarkup(
                createElement(MapPicker, {
                    value: { lat: 14.6, lng: 121 },
                    onChange: jest.fn(),
                    address: "Sample address",
                }),
            );

            expect(html).toContain("The map is unavailable right now.");
            expect(html).toContain("You can continue without a pin");
            expect(html).toContain("View saved pin");
            expect(html).toContain("Remove pin");
            expect(html).not.toContain('data-testid="google-map"');
        },
    );

    it("prevents keyboard map editing while the picker is disabled", () => {
        renderToStaticMarkup(
            createElement(MapPicker, {
                value: null,
                onChange: jest.fn(),
                address: "Sample address",
                disabled: true,
            }),
        );
        expect(mockMapProps.controlled).toBe(true);
        expect(mockMapProps.keyboardShortcuts).toBe(false);
    });
});

describe("Google authentication failure listener", () => {
    it("handles late key rejection and preserves/restores an existing handler", () => {
        const previous = jest.fn();
        const onFailure = jest.fn();
        const target = { gm_authFailure: previous };
        const cleanup = listenForMapAuthFailure(target, onFailure);

        target.gm_authFailure();
        expect(onFailure).toHaveBeenCalledTimes(1);
        expect(previous).toHaveBeenCalledTimes(1);
        cleanup();
        expect(target.gm_authFailure).toBe(previous);
    });

    it("prevents captured callbacks from updating an unmounted picker", () => {
        const target: { gm_authFailure?: () => void } = {};
        const onFailure = jest.fn();
        const cleanup = listenForMapAuthFailure(target, onFailure);
        const captured = target.gm_authFailure!;

        cleanup();
        captured();
        expect(onFailure).not.toHaveBeenCalled();
        expect(Object.prototype.hasOwnProperty.call(target, "gm_authFailure")).toBe(false);
    });

    it("does not overwrite a handler another map installed later", () => {
        const target = { gm_authFailure: jest.fn() };
        const cleanup = listenForMapAuthFailure(target, jest.fn());
        const replacement = jest.fn();
        target.gm_authFailure = replacement;

        cleanup();
        expect(target.gm_authFailure).toBe(replacement);
    });
});
