"use client";

import { Toaster as Sonner } from "sonner";

import { Dot } from "./Status";

/**
 * The app's one toaster, in the Round 1 look: an ink toast, bottom right, one
 * action at most (in gold), gone after 5 seconds. Every existing toast()
 * call picks this up; nothing at the call sites changes.
 *
 * Success and info carry no icon (the sentence says it); an error gets the
 * red problem dot and a warning the gold needs-you dot, so a failure never
 * relies on colour alone: the words say it too.
 *
 * TOASTS OVER AN OPEN DRAWER OR DIALOG. Those are modal <dialog>s in the
 * browser's top layer, which paints above everything else, so the page's
 * toaster would be under them. Drawer and Dialog therefore mount a second
 * toaster INSIDE the <dialog> (`inOverlay`), and round1.css hides the page's
 * one while a modal is open. Every toaster receives every toast, so call sites
 * just call toast() as usual; the page behind a modal is inert, so a screen
 * reader hears only the copy in the overlay.
 */
export function Toaster({ inOverlay = false }: { inOverlay?: boolean } = {}) {
    return (
        <Sonner
            className={inOverlay ? "t-toaster-overlay" : "t-toaster-page"}
            position="bottom-right"
            duration={5000}
            visibleToasts={3}
            gap={8}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: "t-toast",
                    content: "t-toast-content",
                    description: "t-toast-desc",
                    actionButton: "t-toast-action",
                    cancelButton: "t-toast-cancel",
                    icon: "t-toast-icon",
                },
            }}
            icons={{
                success: <></>,
                info: <></>,
                error: <Dot tone="bad" />,
                warning: <Dot tone="attn" />,
            }}
        />
    );
}
