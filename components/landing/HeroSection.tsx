"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Download, Wallet, ArrowDown } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import HeroImg from "@/public/Images/hero-image.png";

export default function HeroSection() {
  const apkUrl = useQuery(api.settings.get, { key: "apk_download_url" }) as string | null;
  const [downloading, setDownloading] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const deferredPrompt = useRef<any>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const isIos = () => {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  };

  const handleInstall = async () => {
    if (isIos()) {
      setShowIosGuide(true);
      return;
    }
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") return;
    }
    if (!apkUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(apkUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Negosyo-Digital.apk";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(apkUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <section className="relative w-full pt-28 pb-20 sm:pt-32 sm:pb-24 px-6 overflow-hidden flex items-center bg-white">
      {/* Soft light-green wash */}
      <div className="absolute -top-32 -right-20 w-[480px] h-[480px] bg-emerald-50 rounded-full filter blur-[120px] opacity-80 pointer-events-none" />
      <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] bg-emerald-100/60 rounded-full filter blur-[140px] opacity-70 pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center relative z-10">
        {/* LEFT — text */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50"
          >
            <Wallet className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold tracking-wide text-emerald-800">
              Side hustle · paid in cash to your Wise wallet
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.05 }}
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-neutral-900 mb-5"
          >
            Earn ₱300–₱500<br />
            <span className="text-emerald-700 italic">every time a local business says yes.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-base sm:text-lg md:text-xl text-neutral-700 max-w-xl mb-3 leading-relaxed"
          >
            We pay you to record one short interview at a local shop — barber shops, restaurants, salons, auto repair. <span className="font-semibold text-neutral-900">Our AI builds the website.</span> You get paid to your Wise wallet.
          </motion.p>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-sm text-neutral-600 max-w-xl mb-10 italic"
          >
            No selling. No deposits. No tech needed.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
          >
            {/* PRIMARY: Start earning — Install creator app */}
            {apkUrl ? (
              <button
                onClick={handleInstall}
                disabled={downloading}
                className="group flex items-center justify-center gap-3 bg-neutral-900 hover:bg-black text-white px-6 sm:px-7 py-4 rounded-full font-semibold text-base sm:text-lg transition-transform hover:scale-[1.02] shadow-lg shadow-neutral-900/15 min-h-[52px] disabled:opacity-70"
              >
                <Download className={`w-5 h-5 text-emerald-400 ${downloading ? "animate-bounce" : "group-hover:translate-y-0.5 transition-transform"}`} />
                <span>{downloading ? "Downloading…" : "Start earning · install app"}</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-3 bg-neutral-900 text-white/50 px-6 sm:px-7 py-4 rounded-full font-semibold text-base sm:text-lg min-h-[52px] cursor-not-allowed"
                aria-label="App install currently unavailable"
              >
                <Download className="w-5 h-5" />
                Start earning · install app
              </button>
            )}

            {/* SECONDARY: Business owner anchor */}
            <a
              href="#for-business"
              className="group flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-full font-semibold text-base transition-colors min-h-[52px]"
            >
              I own a business
              <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </a>
          </motion.div>


        </div>

        {/* RIGHT — single product preview, no fake widgets */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0, scale: 0.96 }}
          animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md mx-auto lg:max-w-none"
        >
          {/* Layered emerald halos — give the floating phone real depth */}
          <div className="absolute inset-0 -m-12 bg-gradient-to-br from-emerald-200/50 via-emerald-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 -m-4 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />

          {/* Phone mockup — transparent PNG, floats freely, subtle lift on hover */}
          <div className="relative flex items-center justify-center group">
            <Image
              src={HeroImg}
              alt="Negosyo Digital creators interviewing local business owners — side-hustle income to your Wise wallet"
              width={800}
              height={1600}
              className="w-full h-auto max-h-[640px] object-contain drop-shadow-[0_40px_80px_rgba(6,95,70,0.30)] transition-transform duration-500 ease-out group-hover:-translate-y-2"
              priority
              sizes="(max-width: 1024px) 90vw, 640px"
            />
          </div>

          {/* Floating trust chip — what creators earn per gig */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0 bg-white px-5 py-3 rounded-2xl shadow-xl shadow-emerald-900/15 border border-emerald-100 flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Per business</p>
              <p className="text-sm font-semibold text-neutral-900">₱300 audio · ₱500 video · paid via Wise</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* iOS Add to Home Screen Guide */}
      {showIosGuide && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end justify-center"
          onClick={() => setShowIosGuide(false)}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md mx-4 mb-8 bg-white rounded-2xl p-6 text-neutral-900 shadow-2xl border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
                <Image src="/logo.png" alt="" width={36} height={36} className="rounded-lg" />
              </div>
              <h3 style={{ fontFamily: "var(--font-fraunces)" }} className="text-2xl font-semibold">Install Negosyo Digital</h3>
              <p className="text-neutral-500 text-sm mt-1">Add to your home screen in 2 steps</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="w-10 h-10 bg-[#007AFF] rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">1. Tap the Share button</p>
                  <p className="text-xs text-neutral-500">The square icon with an arrow at the bottom of Safari</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">2. Tap &quot;Add to Home Screen&quot;</p>
                  <p className="text-xs text-neutral-500">Scroll down in the share menu to find it</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-semibold text-sm transition-colors min-h-[44px]"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </section>
  );
}
