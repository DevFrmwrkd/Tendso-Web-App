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
 */
export function Toaster() {
    return (
        <Sonner
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
