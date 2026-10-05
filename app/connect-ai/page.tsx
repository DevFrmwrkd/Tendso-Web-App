import { redirect } from "next/navigation";

// Connect AI (the free Gemini key) is now the AI key section of Account
// (board Account). The route is kept as a redirect because older pages,
// messages and bookmarks still link here; ?edit=ai opens the section and
// #ai-key brings it into view. Like the old page it is not a public route, so
// a signed-out visitor still goes through sign-in first (see proxy.ts).
export default function ConnectAiRedirect() {
    redirect("/profile?edit=ai#ai-key");
}
