"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Icon } from "@/components/r1";
import { copyText } from "@/app/submissions/_components/LinkRow";

export function CopyButton({ value, label, disabled = false }: { value: string; label: string; disabled?: boolean }) {
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    async function copy() {
        if (busy) return;
        setBusy(true);
        try {
            if (!button.current || !await copyText(value, button.current)) throw new Error("Copy failed");
            setCopied(true);
            toast.success("Copied.");
        } catch {
            toast.error("Could not copy. Select the text and copy it manually.");
        } finally {
            setBusy(false);
        }
    }
    return <Button ref={button} onClick={copy} disabled={disabled || busy} aria-busy={busy} aria-label={label} className="shrink-0"><Icon icon={copied ? Check : Copy} />{copied ? "Copied" : "Copy"}</Button>;
}
