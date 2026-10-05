"use client";

import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
    return (
        <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
            appearance={{
                // The Round 1 look (boards SignIn and ComponentKit: white ground,
                // ink primary button, the .t-input field, gold focus) for anything
                // Clerk draws itself. Today that is the <SignUp> form on /signup.
                //
                // LITERAL COLOURS ON PURPOSE. Clerk reads these values in
                // JavaScript to build its shades and cannot resolve a
                // var(--r1-…) reference, so each one is the literal value of the
                // --r1-* token named beside it (app/round1.css, which carries the
                // design handoff's colour table). Change the two together.
                //
                // STYLE OBJECTS, NOT CLASS NAMES. Clerk's own styles sit outside
                // any CSS layer and Tailwind v4 puts every utility inside one, so
                // a utility class here loses to Clerk's default and silently does
                // nothing. An object is merged into Clerk's own rule instead.
                layout: {
                    socialButtonsPlacement: "bottom",
                    socialButtonsVariant: "blockButton",
                },
                // Clerk's bot check, when it appears, in its light theme on the white ground.
                captcha: { theme: "light" },
                variables: {
                    colorPrimary: "#111111", // --r1-ink: the primary button
                    colorPrimaryForeground: "#FFFFFF", // --r1-paper
                    colorDanger: "#B42318", // --r1-red
                    colorSuccess: "#111111", // --r1-ink: "done" is ink in Round 1, never green
                    colorWarning: "#8A5A14", // --r1-gold-ink: the only gold text colour
                    colorNeutral: "#111111", // --r1-ink: Clerk tints hovers and lines from it
                    colorForeground: "#111111", // --r1-ink
                    colorMutedForeground: "#6B6B72", // --r1-ink-3: meta and hints
                    colorMuted: "#F7F7F6", // --r1-fill-2
                    colorBackground: "#FFFFFF", // --r1-paper
                    colorInput: "#FFFFFF", // --r1-paper
                    colorInputForeground: "#111111", // --r1-ink
                    colorBorder: "#D4D4D0", // --r1-line-2: input and secondary button borders
                    colorRing: "#C89548", // --r1-gold: focus
                    colorShadow: "#111111", // --r1-ink, as the r1 overlay shadows are
                    // A font stack is handed to CSS as written, so a variable works here.
                    fontFamily: "var(--r1-sans)",
                    fontSize: "0.875rem", // 14px, the r1 body size
                    borderRadius: "0.5rem", // --r1-radius: 8px controls
                },
                elements: {
                    // Focus: the r1 gold ring on everything Clerk makes focusable.
                    button: { "&:focus-visible": { outline: "2px solid #C89548", outlineOffset: "2px" } }, // --r1-gold
                    input: { "&:focus-visible": { outline: "2px solid #C89548", outlineOffset: "2px" } }, // --r1-gold
                    // A Clerk card standing on its own is an r1 card: a line, no shadow.
                    cardBox: { border: "1px solid #E7E7E4", borderRadius: "12px", boxShadow: "none" }, // --r1-line, --r1-radius-card
                    card: { boxShadow: "none" },
                    headerTitle: { color: "#111111", fontWeight: 600 }, // --r1-ink
                    headerSubtitle: { color: "#6B6B72" }, // --r1-ink-3
                    // Fields: the .t-field label, the .t-input box, the .t-help and .t-error lines.
                    formFieldLabel: { fontSize: "13px", lineHeight: "18px", fontWeight: 500, color: "#111111" }, // --r1-ink
                    formFieldHintText: { fontSize: "12px", lineHeight: "16px", color: "#6B6B72" }, // --r1-ink-3
                    formFieldInput: {
                        height: "40px",
                        border: "1px solid #D4D4D0", // --r1-line-2
                        borderRadius: "8px", // --r1-radius
                        backgroundColor: "#FFFFFF", // --r1-paper
                        color: "#111111", // --r1-ink
                        boxShadow: "none",
                        // 16px below 640px wide, so iOS does not zoom the page when
                        // the field takes focus, and 14px above: .t-input's media
                        // query, written as a clamp because a style object here
                        // cannot hold an @media rule.
                        fontSize: "clamp(14px, calc((640px - 100vw) * 1000), 16px)",
                        "&::placeholder": { color: "#8A8A92" }, // --r1-placeholder
                        "&:hover": { borderColor: "#B9B9B4" }, // --r1-line-hover
                        "&:focus": { borderColor: "#D4D4D0", boxShadow: "none" }, // the gold ring above, not a tinted border
                    },
                    formFieldInput__error: { borderColor: "#B42318" }, // --r1-red
                    formFieldInputShowPasswordButton: { color: "#6B6B72", "&:hover": { color: "#111111", backgroundColor: "transparent" } }, // --r1-ink-3, --r1-ink
                    formFieldErrorText: { fontSize: "12px", lineHeight: "16px", color: "#B42318" }, // --r1-red
                    formFieldInfoText: { fontSize: "12px", lineHeight: "16px" },
                    formFieldSuccessText: { fontSize: "12px", lineHeight: "16px" },
                    formFieldWarningText: { fontSize: "12px", lineHeight: "16px" },
                    formFieldAction: { color: "#111111", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }, // --r1-ink, as .t-link
                    // The email-code step: the code boxes, "Resend", the address and its edit button.
                    otpCodeFieldInput: { border: "1px solid #D4D4D0", borderRadius: "8px", boxShadow: "none", color: "#111111", fontFamily: "var(--r1-mono)" }, // --r1-line-2, --r1-ink
                    formResendCodeLink: { color: "#111111", fontWeight: 500 }, // --r1-ink
                    identityPreview: { border: "1px solid #E7E7E4", borderRadius: "8px", boxShadow: "none" }, // --r1-line
                    identityPreviewText: { color: "#3F3F46" }, // --r1-ink-2
                    identityPreviewEditButton: { color: "#111111" }, // --r1-ink
                    // Buttons: the board's large primary (ink) and large secondary (white, line-2 border).
                    formButtonPrimary: {
                        height: "48px",
                        borderRadius: "8px", // --r1-radius
                        backgroundColor: "#111111", // --r1-ink
                        backgroundImage: "none",
                        color: "#FFFFFF", // --r1-paper
                        fontSize: "15px",
                        fontWeight: 500,
                        textTransform: "none",
                        boxShadow: "none",
                        "&:hover": { backgroundColor: "#2B2B2B" }, // --r1-ink-hover
                    },
                    buttonArrowIcon: { display: "none" },
                    socialButtonsBlockButton: {
                        height: "48px",
                        borderRadius: "8px", // --r1-radius
                        border: "1px solid #D4D4D0", // --r1-line-2
                        backgroundColor: "#FFFFFF", // --r1-paper
                        boxShadow: "none",
                        "&:hover": { backgroundColor: "#F4F4F2" }, // --r1-fill
                    },
                    socialButtonsBlockButtonText: { fontSize: "15px", fontWeight: 500, color: "#111111" }, // --r1-ink
                    dividerLine: { backgroundColor: "#E7E7E4" }, // --r1-line
                    dividerText: { fontSize: "13px", color: "#6B6B72" }, // --r1-ink-3
                    // The board's error box: a pale red ground, a red line, red words.
                    alert: { backgroundColor: "#FBF1EF", border: "1px solid #E6C4BF", borderRadius: "8px", boxShadow: "none" }, // --r1-red-bg, --r1-red-line
                    alertText: { color: "#B42318", fontSize: "13px", lineHeight: "18px" }, // --r1-red
                    footerAction: { display: "none" },
                    footer: { display: "none" },
                    footerActionLink: { color: "#111111", fontWeight: 500 }, // --r1-ink
                },
            }}
        >
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
}
