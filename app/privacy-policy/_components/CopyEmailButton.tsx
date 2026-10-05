"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button, Icon } from "@/components/r1";

/** Copies the address, for a desk with no mail app behind mailto:. */
export function CopyEmailButton({ email }: { email: string }) {
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(email);
            toast.success(`Email copied: ${email}`);
        } catch {
            // No clipboard (an in-app browser, an insecure context): say the
            // address out loud instead of failing quietly.
            toast(`Our email is ${email}`);
        }
    };
    return (
        <Button size="sm" className="self-start" onClick={copy}>
            <Icon icon={Copy} />
            Copy email
        </Button>
    );
}
