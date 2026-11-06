import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Book a 10-minute call — Tendso' };

export default function BookingLayout({ children }: { children: ReactNode }) {
    return children;
}
