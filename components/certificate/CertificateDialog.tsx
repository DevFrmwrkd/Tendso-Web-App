"use client";

import { Download } from "lucide-react";

import { Button, Dialog, Icon } from "@/components/r1";

import { Certificate } from "./Certificate";
import { useCertificateDownload } from "./useCertificateDownload";

/**
 * "Your certificate" (board Account): the certificate and a Download button.
 * Account opens it from its Certificate row, and by itself when the URL
 * carries ?certificate=1 (the certification notification links there).
 * Saving closes it, as on the board; the toast names the file.
 */
export function CertificateDialog({
    open,
    onClose,
    name,
    firstName,
    issued,
}: {
    open: boolean;
    onClose: () => void;
    name: string;
    /** Names the file: certificate-<first name>.png. */
    firstName?: string | null;
    issued: string;
}) {
    const { ref, download, busy } = useCertificateDownload(firstName);

    const save = async () => {
        if (await download()) onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Your certificate"
            footer={
                <>
                    <Button onClick={onClose}>Close</Button>
                    <Button variant="primary" onClick={save} disabled={busy} aria-busy={busy}>
                        <Icon icon={Download} />
                        {busy ? "Saving…" : "Download"}
                    </Button>
                </>
            }
        >
            <p className="t-meta">Show it to shop owners so they know you are verified.</p>
            <Certificate ref={ref} name={name} issued={issued} />
        </Dialog>
    );
}
