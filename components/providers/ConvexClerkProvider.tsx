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
                layout: {
                    socialButtonsPlacement: "bottom",
                    socialButtonsVariant: "blockButton",
                },
                variables: {
                    colorPrimary: "#E4B05E", // amber-500
                    colorBackground: "#18181b", // zinc-900
                    colorInputBackground: "#27272a", // zinc-800
                    colorInputText: "#ffffff",
                    colorText: "#ffffff",
                    colorTextSecondary: "#a1a1aa", // zinc-400
                    colorDanger: "#ef4444",
                },
                elements: {
                    card: "bg-zinc-900 border border-zinc-800 shadow-xl",
                    headerTitle: "text-white",
                    headerSubtitle: "text-zinc-400",
                    socialButtonsBlockButton: "bg-zinc-700 border border-zinc-600 hover:bg-zinc-600 rounded-xl h-12",
                    socialButtonsBlockButtonText: "text-white",
                    dividerLine: "bg-zinc-700",
                    dividerText: "text-zinc-400 bg-zinc-900",
                    formFieldLabel: "text-zinc-300 font-medium",
                    formFieldInput: "bg-zinc-800 border-zinc-700 text-white rounded-xl h-12",
                    formButtonPrimary: "bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl h-12 shadow-lg",
                    footerAction: "hidden",
                    footer: "hidden",
                    footerActionLink: "text-amber-400 hover:text-amber-300",
                    identityPreview: "bg-zinc-800 border-zinc-700 rounded-xl",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-amber-400 hover:text-amber-300",
                    formFieldAction: "text-amber-400 hover:text-amber-300 font-medium",
                    alert: "bg-red-900/50 border-red-800 text-red-200 rounded-xl",
                    alertText: "text-red-200",
                    formFieldInputShowPasswordButton: "text-zinc-400 hover:text-white",
                },
            }}
        >
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    );
}
