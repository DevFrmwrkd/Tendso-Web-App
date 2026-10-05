"use client";

import { Search } from "lucide-react";

import { Button, Icon } from "@/components/r1";

import { useHelpPalette } from "./HelpCenterShell";

/** Opens the Help Center search palette (for server-rendered pages such as the 404). */
export function OpenSearchButton() {
    const { openPalette } = useHelpPalette();
    return (
        <Button variant="primary" onClick={() => openPalette()}>
            <Icon icon={Search} />
            Search the Help Center
        </Button>
    );
}
