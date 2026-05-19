"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/public/logo.png";
import { Menu, X, ArrowRight } from "lucide-react";

// Use leading "/" so anchors always route to the home page from any route
const navLinks = [
  { name: "How it works", href: "/#how-it-works" },
  { name: "Live work", href: "/#showcase" },
  { name: "Pricing", href: "/#for-business" },
  { name: "For creators", href: "/#for-creators" },
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 backdrop-blur-md ${scrolled
        ? "py-3 shadow-sm border-b border-[var(--ink)]/10"
        : "py-5 border-b border-transparent"
        }`}
      style={{
        background: scrolled ? "rgba(244, 237, 225, 0.92)" : "transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex justify-between items-center">
        {/* BRAND */}
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          aria-label="Negosyo Digital home"
        >
          <Image src={Logo} alt="" width={36} height={36} className="rounded-lg shadow-sm shadow-[var(--rust)]/20" />
          <span
            style={{ fontFamily: "var(--font-playfair)" }}
            className="text-xl font-bold text-[var(--ink)] tracking-tight"
          >
            Negosyo Digital
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-7">
          <div className="flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-[var(--ink)]/75 hover:text-[var(--rust)] text-sm font-medium transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <Link
            href="/signup"
            className="group flex items-center gap-2 bg-[var(--ink)] hover:bg-[var(--rust)] text-[var(--khaki)] px-5 py-2.5 rounded-full font-semibold text-sm transition-all hover:-translate-y-0.5 shadow-sm shadow-[var(--ink)]/20 min-h-[40px]"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* MOBILE TOGGLE */}
        <button
          className="md:hidden w-11 h-11 flex items-center justify-center text-[var(--ink)] hover:text-[var(--rust)] rounded-full transition-colors"
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
            className="md:hidden absolute top-full left-0 w-full overflow-hidden border-t border-[var(--ink)]/10"
            style={{ background: "var(--khaki)" }}
          >
            <div className="flex flex-col px-6 py-8 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-[var(--ink)] hover:text-[var(--rust)] text-2xl font-bold py-3 transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  {link.name}
                </Link>
              ))}

              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-6 group flex items-center justify-center gap-2 bg-[var(--ink)] hover:bg-[var(--rust)] text-[var(--khaki)] py-4 rounded-full font-semibold text-base transition-colors shadow-md shadow-[var(--ink)]/20 min-h-[52px]"
              >
                Get started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 bg-[var(--khaki-deep)] border border-[var(--ink)]/15 hover:border-[var(--rust)]/50 text-[var(--ink)] py-3.5 rounded-full font-semibold text-sm transition-colors min-h-[48px]"
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
