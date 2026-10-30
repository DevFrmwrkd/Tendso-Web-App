"use client";

import { LockKeyhole } from "lucide-react";

import { Button, Dialog } from "@/components/r1";
import { CODE_PERCENT_OFF } from "@/lib/v2/creatorProgram";

import styles from "./CreatorCodeConfirmDialog.module.css";

export function CreatorCodeConfirmDialog({ open, code, busy, canConfirm, creatingAccount = false, onCancel, onConfirm }: {
    open: boolean;
    code: string;
    busy: boolean;
    canConfirm: boolean;
    creatingAccount?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return <Dialog open={open} onClose={busy ? () => {} : onCancel} title="Confirm your creator code" role="alertdialog" className={styles.dialog} footer={<>
        <Button className={styles.secondary} onClick={onCancel} disabled={busy} autoFocus>Keep editing</Button>
        <Button className={styles.primary} variant="primary" onClick={onConfirm} disabled={busy || !canConfirm} aria-busy={busy}>
            {busy ? "Confirming…" : creatingAccount ? "Confirm and create account" : "Confirm code"}
        </Button>
    </>}>
        <div className={styles.codeBox}><span>Your creator code</span><strong>{code}</strong></div>
        <p className={styles.warning}>You cannot change this code after {creatingAccount ? "creating your account" : "confirming it"}.</p>
        <p className={styles.note}><LockKeyhole size={18} aria-hidden="true" /><span>Your code gives shop owners the fixed {CODE_PERCENT_OFF}% discount.</span></p>
    </Dialog>;
}
