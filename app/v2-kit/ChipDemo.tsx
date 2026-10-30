"use client";

import { useState } from "react";

import { Chip } from "@/components/v2";

const KINDS = [
    { k: "All", n: 12 },
    { k: "Barber", n: 3 },
    { k: "Mechanic", n: 2 },
    { k: "Salon", n: 4 },
    { k: "Tailor", n: 2 },
    { k: "Laundry", n: 1 },
    { k: "Welding", n: 0 },
];

/** The only client piece of the kit: chips hold no state themselves. */
export function ChipDemo() {
    const [kind, setKind] = useState("All");
    return (
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter by kind of business">
            {KINDS.map(({ k, n }) => (
                <Chip key={k} pressed={kind === k} count={n} disabled={n === 0} onClick={() => setKind(k)}>
                    {k}
                </Chip>
            ))}
        </div>
    );
}
