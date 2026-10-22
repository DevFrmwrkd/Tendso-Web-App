import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: { default: "Tendso for creators", template: "%s · Tendso" },
    description:
        "Share Tendso online. Shops save with your code and you keep ₱1,750 per shop. Field agents who join through your link earn you 5% of their sales for 12 months.",
};

/** The /v2/creators section. Each page renders its own CreatorsRoot (the root class differs per page). */
export default function CreatorsLayout({ children }: { children: ReactNode }) {
    return children;
}
