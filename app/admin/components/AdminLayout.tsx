"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useClerk } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
    LayoutDashboard,
    Users,
    CreditCard,
    History,
    Download,
    Sparkles,
    FileText,
    LogOut,
    Menu,
    X,
    ChevronRight
} from "lucide-react"

const navItems = [
    {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        label: "Creators",
        href: "/admin/creators",
        icon: Users,
    },
    {
        label: "Leads",
        href: "/admin/leads",
        icon: FileText,
    },
    {
        label: "Payouts",
        href: "/admin/payouts",
        icon: CreditCard,
    },
    {
        label: "Audit Logs",
        href: "/admin/audit",
        icon: History,
    },
    {
        label: "App Release",
        href: "/admin/app-release",
        icon: Download,
    },
    {
        label: "Train AI",
        href: "/admin/knowledge",
        icon: Sparkles,
    },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { signOut } = useClerk()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    // Pending Approval badge count — reactive. Returns undefined until the
    // admin auth check resolves on the Convex side; we render the badge only
    // when count > 0 so non-admins and the initial loading state stay silent.
    const pendingApprovals = useQuery(api.creators.listPendingApproval, {}) as
        | { _id: string }[]
        | undefined
    const pendingCount = pendingApprovals?.length ?? 0

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10)
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const handleLogout = async () => {
        await signOut()
        router.push("/login")
    }

    return (
        <div
            className="editorial min-h-screen flex font-sans selection:bg-amber-100 selection:text-amber-900"
            style={{
                background: "var(--ed-paper)",
                color: "var(--ed-ink)",
                fontFamily: "var(--ed-sans)",
            }}
        >
            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" 
                        onClick={() => setSidebarOpen(false)} 
                    />
                )}
            </AnimatePresence>

            {/* Sidebar — ink surface with editorial paper accents */}
            <aside
                className={`
                w-64 flex flex-col fixed inset-y-0 left-0 z-50
                transition-all duration-300 ease-in-out shadow-[4px_0_24px_-4px_rgba(0,0,0,0.02)]
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
            `}
                style={{
                    background: "var(--ed-ink)",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <div className="px-6 py-8 flex items-center justify-between mb-2">
                    <Link href="/admin" className="flex flex-col gap-2 group">
                        {/* White wordmark — sidebar is the dark --ed-ink surface */}
                        <Image
                            src="/tendso-logo.png"
                            alt="Tendso"
                            width={150}
                            height={27}
                            className="transition-transform duration-500 group-hover:scale-105"
                            priority
                        />
                        <span
                            className="text-[10px] uppercase"
                            style={{
                                fontFamily: "var(--ed-mono)",
                                letterSpacing: "0.18em",
                                color: "var(--ed-accent-solid)",
                            }}
                        >
                            Admin
                        </span>
                    </Link>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-full transition-colors"
                        style={{ color: "var(--ed-paper-3)" }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200 group"
                                style={{
                                    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                    color: isActive ? "var(--ed-paper-3)" : "rgba(252,250,245,0.6)",
                                    fontFamily: "var(--ed-sans)",
                                    fontWeight: isActive ? 500 : 400,
                                    letterSpacing: "-0.005em",
                                }}
                            >
                                <div className="flex items-center gap-3.5">
                                    <Icon
                                        size={18}
                                        strokeWidth={isActive ? 2 : 1.6}
                                        style={{
                                            color: isActive
                                                ? "var(--ed-accent-solid)"
                                                : "rgba(252,250,245,0.55)",
                                            transition: "color .2s ease",
                                        }}
                                    />
                                    <span>{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Pending Approval count badge — now attached to Creators
                                        since the Pending queue lives inside that page as a tab. */}
                                    {item.href === "/admin/creators" && pendingCount > 0 && (
                                        <span
                                            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold"
                                            style={{
                                                background: "var(--ed-accent-solid)",
                                                color: "var(--ed-ink)",
                                                fontFamily: "var(--ed-mono)",
                                            }}
                                            title={`${pendingCount} creator${pendingCount === 1 ? "" : "s"} waiting for approval`}
                                        >
                                            {pendingCount > 99 ? "99+" : pendingCount}
                                        </span>
                                    )}
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-pill"
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ background: "var(--ed-accent-solid)" }}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="px-4 py-6 mt-auto">
                    <div
                        className="p-4 rounded-2xl mb-4 lg:hidden"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{
                                    background: "rgba(255,255,255,0.08)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                }}
                            >
                                <Users size={14} style={{ color: "var(--ed-accent-solid)" }} />
                            </div>
                            <span
                                className="text-[10px] uppercase"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.12em",
                                    color: "var(--ed-paper-3)",
                                }}
                            >
                                Quick Tools
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm w-full transition-all duration-200 group"
                        style={{
                            color: "rgba(252,250,245,0.7)",
                            fontFamily: "var(--ed-sans)",
                        }}
                    >
                        <LogOut size={18} strokeWidth={1.6} className="transition-colors group-hover:text-red-400" style={{ color: "rgba(252,250,245,0.55)" }} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-64 min-w-0 min-h-screen flex flex-col relative">
                {/* Header (Universal) */}
                <header
                    className={`
                        sticky top-0 z-30 transition-all duration-300
                        ${scrolled ? "py-3" : "py-5"}
                        px-4 sm:px-6 lg:px-8 flex items-center justify-between
                    `}
                    style={{
                        background: scrolled ? "rgba(248,245,238,0.85)" : "transparent",
                        borderBottom: scrolled ? "1px solid var(--ed-rule)" : "1px solid transparent",
                        backdropFilter: scrolled ? "blur(12px)" : "none",
                    }}
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 rounded-lg transition-colors"
                            style={{ color: "var(--ed-ink-3)" }}
                        >
                            <Menu size={24} />
                        </button>
                        <div className="hidden lg:flex flex-col">
                            <h2
                                className="text-sm"
                                style={{
                                    fontFamily: "var(--ed-serif)",
                                    color: "var(--ed-ink)",
                                    fontSize: 18,
                                }}
                            >
                                Overview
                            </h2>
                            <p
                                className="flex items-center gap-1.5 mt-0.5"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    fontSize: 10,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-3)",
                                }}
                            >
                                <span className="ed-live-dot"></span>
                                Live system monitor
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
                            style={{
                                background: "var(--ed-paper-3)",
                                border: "1px solid var(--ed-rule)",
                                boxShadow: "var(--ed-shadow-sm)",
                            }}
                        >
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] uppercase"
                                style={{
                                    background: "var(--ed-ink)",
                                    color: "var(--ed-paper-3)",
                                    fontFamily: "var(--ed-mono)",
                                    letterSpacing: "0.08em",
                                }}
                            >
                                AD
                            </div>
                            <span
                                className="text-xs"
                                style={{
                                    fontFamily: "var(--ed-mono)",
                                    fontSize: 11,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    color: "var(--ed-ink-2)",
                                }}
                            >
                                Administrator
                            </span>
                            <ChevronRight size={12} style={{ color: "var(--ed-ink-3)" }} />
                        </div>
                    </div>
                </header>

                <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6 flex-1">{children}</div>

                <footer
                    className="px-8 py-6 text-center"
                    style={{
                        fontFamily: "var(--ed-mono)",
                        fontSize: 10,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--ed-ink-3)",
                    }}
                >
                    &copy; {new Date().getFullYear()} Tendso &bull; Admin
                </footer>
            </main>
        </div>
    )
}
