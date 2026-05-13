"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/public/logo.png";
import { Menu, X, ArrowRight } from "lucide-react";
import { Bricolage_Grotesque } from 'next/font/google';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '800'] });

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Features", href: "#features" },
    { name: "Earnings", href: "#earnings" },
    { name: "Privacy Policy", href: "/privacy-policy" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-in-out backdrop-blur-md ${
        scrolled
          ? "bg-white/80 py-4 shadow-sm border-b border-neutral-200"
          : "bg-transparent py-6 border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
        {/* BRAND */}
        <Link href="/" className={`text-neutral-900 text-2xl tracking-tighter hover:opacity-80 transition-opacity flex items-center gap-3 ${bricolage.className}`}>
          <Image src={Logo} alt="Logo" width={36} height={36} className="rounded-xl shadow-md shadow-emerald-500/20" />
          NegosyoDigital
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex bg-neutral-50 rounded-full px-6 py-2 border border-neutral-200 gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-neutral-700 hover:text-emerald-600 text-sm font-medium tracking-wide transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`group flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-full font-bold text-sm overflow-hidden relative shadow-md shadow-emerald-500/30 transition-colors ${bricolage.className}`}
            >
              <span className="relative z-10">LOGIN</span>
              <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
        </div>

        {/* MOBILE TOGGLE */}
        <button
          className="md:hidden text-neutral-900 hover:text-emerald-600 transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "100vh" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden absolute top-full left-0 w-full bg-white border-t border-neutral-200 overflow-hidden"
          >
            <div className="flex flex-col px-6 py-10 gap-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.name}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    href={link.href}
                    className="text-neutral-900 text-3xl font-light tracking-tight hover:text-emerald-600 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <button className={`w-full bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-xl tracking-wider uppercase transition-colors ${bricolage.className}`}>
                    Login
                  </button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
