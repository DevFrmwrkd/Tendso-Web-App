import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { useSearchParams } from "next/navigation";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BusinessInfoPage from "@/app/submit/info/page";
import ReviewSubmissionPage from "@/app/submit/review/page";
import { infoErrors, infoFromDoc, type InfoValues } from "@/app/submit/_components/flow";

jest.mock("convex/react", () => ({ useQuery: jest.fn(), useMutation: () => jest.fn() }));
jest.mock("@/convex/_generated/api", () => ({ api: jest.requireActual("convex/server").anyApi }));
jest.mock("@clerk/nextjs", () => ({ useUser: jest.fn() }));
jest.mock("next/navigation", () => ({ useSearchParams: jest.fn(), useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/app/submit/_components/useDraftId", () => ({
    useRequiredDraftId: () => "j123456789012345678901234567890",
}));

const draftId = "j123456789012345678901234567890";
const creatorId = "creator-1";
const validInfo: InfoValues = {
    businessName: "Ramon’s shop", businessType: "Barbershop", ownerName: "Ramon Cruz",
    ownerPhone: "09181234567", ownerEmail: "ramon@example.com", city: "Marikina", address: "10 Main St",
};

let draft: Record<string, unknown>;

beforeEach(() => {
    jest.clearAllMocks();
    draft = { ...validInfo, _id: draftId, creatorId, status: "draft", photos: [], amount: 999 };
    (useUser as jest.Mock).mockReturnValue({ user: { id: "user-1" }, isLoaded: true, isSignedIn: true });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(`draftId=${draftId}&focus=ownerEmail`));
    (useQuery as jest.Mock).mockImplementation((reference, args) => {
        if (args === "skip") return undefined;
        switch (getFunctionName(reference)) {
            case "creators:getByClerkId": return { _id: creatorId };
            case "submissions:getById": return draft;
            case "submissions:getDraftByCreatorId": return { ...draft, businessName: "Another newer draft" };
            default: return undefined;
        }
    });
});

it.each(["", "   "])("requires the owner email when continuing Business, including %j", (ownerEmail) => {
    expect(infoErrors({ ...validInfo, ownerEmail })).toEqual({ ownerEmail: "Enter the owner’s email address." });
});

it("uses the same owner-email validation for new and recovered business details", () => {
    expect(infoErrors({ ...validInfo, ownerEmail: "broken@" }).ownerEmail).toBe("Enter a valid email address for the owner.");
    expect(infoErrors({ ...validInfo, ownerEmail: "  ramon@example.com  " })).toEqual({});
    expect(infoErrors(infoFromDoc({ ...validInfo, ownerEmail: undefined })).ownerEmail).toBe("Enter the owner’s email address.");
});

it("marks the web email input required and loads the review’s exact older draft", () => {
    const html = renderToStaticMarkup(createElement(BusinessInfoPage));
    const input = html.match(/<input[^>]*type="email"[^>]*>/)?.[0];
    expect(input).toContain('required=""');
    expect(input).toContain('value="ramon@example.com"');
    expect(input).toContain('maxLength="320"');
    expect(html).toContain("Owner’s email");
    expect(html).not.toContain("(optional)");
    expect(html).not.toContain("Another newer draft");
});

it("keeps the newest-draft resume behavior when opening an ordinary capture", () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    const html = renderToStaticMarkup(createElement(BusinessInfoPage));
    expect(html).toContain('value="Another newer draft"');
});

it.each(["", "invalid-email"])("offers a direct owner-email edit action for a legacy review with %j", (ownerEmail) => {
    draft.ownerEmail = ownerEmail;
    const html = renderToStaticMarkup(createElement(ReviewSubmissionPage));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Edit owner’s email");
    expect(html).toContain(`/submit/info?draftId=${draftId}&amp;focus=ownerEmail`);
    expect(html).toContain("Save draft");
});

it("does not show an email warning for a valid saved owner address", () => {
    const html = renderToStaticMarkup(createElement(ReviewSubmissionPage));
    expect(html).not.toContain("Edit owner’s email");
    expect(html).not.toContain("Email required");
});

it.each([
    { creatorId: "someone-else", status: "draft" },
    { creatorId, status: "submitted" },
])("does not edit a requested draft outside the current creator’s editable drafts: %j", (record) => {
    draft = { ...draft, ...record, ownerName: "Private other name" };
    const html = renderToStaticMarkup(createElement(BusinessInfoPage));
    expect(html).toContain("This draft is not here any more");
    expect(html).not.toContain("Private other name");
    expect(html).not.toContain('type="email"');
});
