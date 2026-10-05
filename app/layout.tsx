import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { ConvexClerkProvider } from "@/components/providers/ConvexClerkProvider";
import { JsonLd } from "@/components/JsonLd";
import { Toaster } from "@/components/r1/Toaster";
import { organizationGraph, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./self-hosted-fonts.css";

// Typefaces are self-hosted (see app/self-hosted-fonts.css) rather than pulled
// from next/font/google, which downloaded them during the build and could fail
// the whole deploy when one fetch did. The --font-* variables that file declares
// are the same ones globals.css already read, so nothing below changed.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Tendso — The Thinking Ends Here. So the work doesn't.",
  description: "A business page built around the work, not the other way around. A creator visits, asks a few questions, photographs your shop, and your page goes live in 48 hours. No template, no blank screen. ₱999 one-time. For Filipino local businesses whose hands are full.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Tendso",
    locale: "en_PH",
    url: SITE_URL,
    title: "Tendso — The Thinking Ends Here. So the work doesn't.",
    description: "Filipino local businesses get online in 48 hours. ₱999 one-time. Built around the work, not the other way around.",
  },
  twitter: { card: "summary_large_image", title: "Tendso", description: "Filipino local businesses get online in 48 hours." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/tendso-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E4B05E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tendso" />
        <link rel="apple-touch-icon" href="/tendso-icon.png" />
        {/* Platform entity graph — read by AI crawlers from the initial HTML */}
        <JsonLd data={organizationGraph()} />
      </head>
      <body
        className="antialiased"
      >
        <ConvexClerkProvider>
          {children}
        </ConvexClerkProvider>
        <Toaster />
        <Analytics />
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js")}` }} />
      </body>
    </html>
  );
}
