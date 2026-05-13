import Link from "next/link";
import Image from "next/image";
import Logo from "@/public/logo.png";
import { Phone, ArrowUpRight } from "lucide-react";

const PHONE_DISPLAY = "0967 145 5245";
const PHONE_TEL = "tel:+639671455245";

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-white py-16 sm:py-20 border-t border-neutral-800 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      <div className="absolute -left-[20%] -bottom-[40%] w-[60%] h-[80%] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8 mb-12">
          {/* Brand + phone */}
          <div className="sm:col-span-2 flex flex-col items-start gap-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <Image src={Logo} alt="" width={44} height={44} className="rounded-lg shadow-md shadow-emerald-500/30" />
              <span style={{ fontFamily: "var(--font-fraunces)" }} className="text-2xl font-semibold tracking-tight">
                Negosyo Digital
              </span>
            </Link>
            <p className="text-white/65 text-base max-w-sm leading-relaxed">
              Real coded websites for Filipino local businesses. Live in 48 hours. ₱1,000 one-time. No monthly fees.
            </p>

            <a
              href={PHONE_TEL}
              className="group mt-2 inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 px-5 py-3 rounded-full font-semibold text-sm transition-transform hover:scale-[1.02] min-h-[44px]"
              aria-label={`Call ${PHONE_DISPLAY}`}
            >
              <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Call us: {PHONE_DISPLAY}
            </a>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-3">
            <h4
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-sm font-semibold uppercase tracking-widest text-emerald-400"
            >
              Product
            </h4>
            <Link href="#how-it-works" className="text-white/70 hover:text-white text-sm transition-colors">How it works</Link>
            <Link href="#showcase" className="text-white/70 hover:text-white text-sm transition-colors">Live sites</Link>
            <Link href="#pricing" className="text-white/70 hover:text-white text-sm transition-colors">Pricing</Link>
            <Link href="/creators" className="text-white/70 hover:text-white text-sm transition-colors flex items-center gap-1 group">
              Earn as a creator
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h4
              style={{ fontFamily: "var(--font-fraunces)" }}
              className="text-sm font-semibold uppercase tracking-widest text-emerald-400"
            >
              Legal
            </h4>
            <Link href="/privacy-policy" className="text-white/70 hover:text-white text-sm transition-colors">Privacy Policy</Link>
            <Link href="/terms-of-service" className="text-white/70 hover:text-white text-sm transition-colors">Terms of Service</Link>
            <Link href="/login" className="text-white/70 hover:text-white text-sm transition-colors flex items-center gap-1 group">
              Login to portal
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 gap-3">
          <p className="text-white/50 text-sm text-center md:text-left">
            © {new Date().getFullYear()} Negosyo Digital. All rights reserved.
          </p>
          <p className="text-white/40 text-xs tracking-widest uppercase">
            Made in the Philippines · Para sa local na negosyo
          </p>
        </div>
      </div>
    </footer>
  );
}
