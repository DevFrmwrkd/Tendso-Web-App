"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/public/logo.png";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { name: "How it works", href: "#how-it-works" },
  { name: "Earnings", href: "#earnings" },
  { name: "Live sites", href: "#showcase" },
  { name: "For business", href: "#for-business" },
  { name: "About", href: "/about" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 backdrop-blur-md ${
        scrolled
          ? "bg-white/85 py-3 shadow-sm border-b border-neutral-200"
          : "bg-transparent py-5 border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex justify-between items-center">
        {/* BRAND */}
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          aria-label="Negosyo Digital home"
        >
          <Image src={Logo} alt="" width={36} height={36} className="rounded-lg shadow-sm shadow-emerald-500/20" />
          <span
            style={{ fontFamily: "var(--font-fraunces)" }}
            className="text-xl font-semibold text-neutral-900 tracking-tight"
          >
            Negosyo Digital
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-neutral-700 hover:text-emerald-700 text-sm font-medium transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <Link
            href="/signup"
            className="group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full font-semibold text-sm transition-all hover:scale-[1.02] shadow-sm shadow-emerald-600/20 min-h-[40px]"
          >
            <span>Become a Creator</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* MOBILE TOGGLE */}
        <button
          className="md:hidden w-11 h-11 flex items-center justify-center text-neutral-900 hover:text-emerald-700 rounded-full transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "100vh" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden absolute top-full left-0 w-full bg-white border-t border-neutral-200 overflow-hidden"
          >
            <div className="flex flex-col px-6 py-8 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-neutral-900 hover:text-emerald-700 text-2xl font-medium py-3 transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ fontFamily: "var(--font-fraunces)" }}
                >
                  {link.name}
                </Link>
              ))}

              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-6 group flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-full font-semibold text-base transition-colors shadow-md shadow-emerald-600/20 min-h-[52px]"
              >
                Become a Creator
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 bg-white border border-neutral-200 hover:border-emerald-300 text-neutral-900 py-3.5 rounded-full font-semibold text-sm transition-colors min-h-[48px]"
              >
                Login
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
