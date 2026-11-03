"use client";

import type { FormEvent, MouseEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { isAdminPreviewHref, type AdminPreviewRole } from '@/lib/admin-preview-navigation';

const CREATOR_SECTIONS = new Set(['dashboard', 'wallet', 'leads', 'submissions', 'referrals']);

export function PreviewGuard({ role, children }: { role: AdminPreviewRole; children: ReactNode }) {
    const keepSample = (event: MouseEvent<HTMLDivElement>) => {
        const link = (event.target as HTMLElement).closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        const fragment = href?.split('#')[1];
        const unsupportedSection = role === 'creator' && !!fragment
            && (href?.startsWith('#') || href?.startsWith('/admin/preview/creator')) && !CREATOR_SECTIONS.has(fragment);
        if (isAdminPreviewHref(href, role) && !unsupportedSection) return;
        event.preventDefault();
        event.stopPropagation();
        toast.info('This action is unavailable in a sample preview. Your account is unchanged.');
    };
    const preventSubmit = (event: FormEvent<HTMLDivElement>) => {
        const form = event.target as HTMLFormElement | null;
        // The shared editor's preview branch saves local React state only.
        if (role === 'affiliate' && form?.tagName === 'FORM' && form.getAttribute('data-preview-local-save') === 'true') return;
        event.preventDefault();
        event.stopPropagation();
        toast.info('Sample edits stay in this preview. Nothing is saved to an account.');
    };
    return <div onClickCapture={keepSample} onAuxClickCapture={keepSample} onSubmitCapture={preventSubmit}>{children}</div>;
}
