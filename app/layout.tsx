import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono, Instrument_Serif, Onest } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { ConvexClerkProvider } from "@/components/providers/ConvexClerkProvider";
import CustomCursor from "@/components/landing/CustomCursor";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Display serif — Vision-style high-contrast editorial typeface
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

// Monospace for editorial section markers (§ 01 — THE VISION)
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// NEO LAB landing: italic-friendly magazine serif for display type
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

// NEO LAB landing: clean editorial sans (the body face)
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Negosyo Digital — Your business, online in 48 hours",
  description: "Real coded websites for Filipino local businesses. ₱1,000 one-time. No monthly fees. From barber shops to restaurants, salons to auto repair — live in 48 hours.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Negosyo Digital" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body
        className={`${fraunces.variable} ${plusJakarta.variable} ${playfair.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${onest.variable} antialiased`}
      >
        <ConvexClerkProvider>
          <CustomCursor />
          {children}
        </ConvexClerkProvider>
        <Toaster position="top-right" richColors />
        <Analytics />
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js")}` }} />
      </body>
    </html>
  );
}
