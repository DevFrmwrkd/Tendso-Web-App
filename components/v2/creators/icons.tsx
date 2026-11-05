import type { SVGProps } from "react";

/** Inline icons from the mock (Lucide shapes and the two store marks). Decorative: always aria-hidden. */
type P = SVGProps<SVGSVGElement>;

const stroke = (size: number, sw = 2) =>
    ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }) as const;

export const AppleIcon = (p: P) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
        <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28Z" />
    </svg>
);
export const PlayIcon = (p: P) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
        <path d="M4.6 2.3 13.4 11 4.6 19.7c-.36-.2-.6-.6-.6-1.07V3.37c0-.47.24-.87.6-1.07Z" />
        <path d="m14.5 12.1 2.5 2.5-10.6 6.1 8.1-8.6Z" opacity=".8" />
        <path d="m14.5 9.9-8.1-8.6L17 7.4l-2.5 2.5Z" opacity=".8" />
        <path d="m18.3 8.2 2.6 1.5c.85.5.85 1.7 0 2.2l-2.6 1.5-2.7-2.7 2.7-2.5Z" opacity=".6" />
    </svg>
);
export const PlusIcon = (p: P) => (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" {...p}>
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);
export const CopyIcon = (p: P) => (
    <svg {...stroke(16)} {...p}>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);
export const ShareIcon = (p: P) => (
    <svg {...stroke(16)} {...p}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="m16 6-4-4-4 4" />
        <path d="M12 2v13" />
    </svg>
);
export const BackIcon = (p: P) => (
    <svg {...stroke(20)} {...p}>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </svg>
);
export const ClockIcon = (p: P) => (
    <svg {...stroke(40, 1.8)} {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
    </svg>
);
export const CoachIcon = (p: P) => (
    <svg {...stroke(26, 1.8)} {...p}>
        <path d="M12 3 2 8l10 5 10-5-10-5Z" />
        <path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" />
    </svg>
);
export const ChatIcon = (p: P) => (
    <svg {...stroke(26, 1.8)} {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);
export const FastIcon = (p: P) => (
    <svg {...stroke(26, 1.8)} {...p}>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);
export const KitIcon = (p: P) => (
    <svg {...stroke(26, 1.8)} {...p}>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
);
export const ArrowDownIcon = (p: P) => (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...p}>
        <path d="M12 4v15m-6-6 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
export const ArrowRightIcon = (p: P) => (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...p}>
        <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
export const MenuIcon = (p: P) => (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" {...p}>
        <path d="M2 5h12M2 11h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

// app screen icons (inside the hero phone)
export const HomeTabIcon = (p: P) => (
    <svg {...stroke(22)} {...p}>
        <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
);
export const UsersTabIcon = (p: P) => (
    <svg {...stroke(22)} {...p}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
export const WalletTabIcon = (p: P) => (
    <svg {...stroke(22)} {...p}>
        <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
        <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
);
export const StoreIcon = (p: P) => (
    <svg {...stroke(22)} {...p}>
        <path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.4a2 2 0 0 1 1.4.6L22 7" />
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="M2 7h20v3a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2z" />
    </svg>
);
export const CalendarIcon = (p: P) => (
    <svg {...stroke(22)} {...p}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
);
export const LinkIcon = (p: P) => (
    <svg {...stroke(20)} {...p}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);
