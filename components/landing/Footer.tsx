import Link from "next/link";
import Image from "next/image";
import Logo from "@/public/logo.png";
import { ArrowUpRight, ArrowRight } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden py-20 sm:py-24 border-t border-[var(--khaki)]/10"
      style={{ background: "var(--ink)", color: "var(--khaki)" }}
    >
      <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--rust-soft)]/50 to-transparent" />
      <div className="absolute -left-[20%] -bottom-[40%] w-[60%] h-[80%] bg-[var(--rust-soft)]/12 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        {/* Top section marker */}
        <div className="flex items-center gap-3 mb-12 sm:mb-14">
          <span className="h-px w-12 bg-[var(--rust-soft)]/50" />
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.45em] font-medium text-[var(--rust-soft)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            § FIN — NEGOSYO DIGITAL
          </p>
          <span className="h-px w-12 bg-[var(--rust-soft)]/50" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8 mb-14">
          {/* Brand + tagline + CTA */}
          <div className="sm:col-span-2 flex flex-col items-start gap-5">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <Image src={Logo} alt="" width={44} height={44} className="rounded-lg shadow-md shadow-[var(--rust-soft)]/30" />
              <span
                style={{ fontFamily: "var(--font-playfair)" }}
                className="text-2xl font-bold tracking-tight"
              >
                Negosyo Digital
              </span>
            </Link>

            <p
              className="text-[var(--khaki)]/65 max-w-md italic leading-relaxed"
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "clamp(1.05rem, 1.4vw, 1.2rem)",
              }}
            >
              Real shops. Real websites. Real fast. A website for every shop on Earth.
            </p>

            <Link
              href="/signup"
              className="group mt-3 inline-flex items-center gap-3 bg-[var(--rust)] hover:bg-[var(--rust-soft)] text-[var(--khaki)] px-6 py-3 rounded-full font-semibold text-sm transition-all hover:-translate-y-0.5 min-h-[44px]"
            >
              Get started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Product column */}
          <div className="flex flex-col gap-3">
            <h4
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust-soft)] mb-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              § 01 — Product
            </h4>
            <Link
              href="#how-it-works"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              How it works
            </Link>
            <Link
              href="#showcase"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Live work
            </Link>
            <Link
              href="#for-business"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Pricing
            </Link>
            <Link
              href="#for-creators"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base flex items-center gap-1 group"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              <span className="italic">For creators</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Legal column */}
          <div className="flex flex-col gap-3">
            <h4
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--rust-soft)] mb-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              § 02 — Legal
            </h4>
            <Link
              href="/privacy-policy"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="text-[var(--khaki)]/70 hover:text-[var(--khaki)] transition-colors text-base flex items-center gap-1 group"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              <span className="italic">Login to portal</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[var(--khaki)]/10 gap-3">
          <p className="text-[var(--khaki)]/50 text-sm text-center md:text-left">
            © {new Date().getFullYear()} Negosyo Digital. All rights reserved.
          </p>
          <p
            className="text-[var(--khaki)]/40 text-[10px] tracking-[0.5em] uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Made in the Philippines · Para sa local na negosyo
          </p>
        </div>
      </div>
    </footer>
  );
}
