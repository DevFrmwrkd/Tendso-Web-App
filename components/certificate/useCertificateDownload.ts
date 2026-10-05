"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Save the certificate as a PNG, exactly as every copy did before: the node
 * rendered at 3x through html-to-image, downloaded as
 * `certificate-<first name>.png`. Put `ref` on the <Certificate> and call
 * `download()`; it resolves true once the file has been handed to the browser.
 */
export function useCertificateDownload(firstName?: string | null) {
    const ref = useRef<HTMLDivElement>(null);
    const [busy, setBusy] = useState(false);

    const download = async (): Promise<boolean> => {
        const node = ref.current;
        if (!node || busy) return false;
        setBusy(true);
        try {
            const dataUrl = await toPng(node, { pixelRatio: 3 });
            const fileName = `certificate-${firstName || "creator"}.png`;
            const link = document.createElement("a");
            link.download = fileName;
            link.href = dataUrl;
            link.click();
            toast.success(`Saved ${fileName}`);
            return true;
        } catch (err) {
            console.error("Failed to download certificate:", err);
            toast.error("The certificate did not save. Try again.");
            return false;
        } finally {
            setBusy(false);
        }
    };

    return { ref, download, busy };
}
