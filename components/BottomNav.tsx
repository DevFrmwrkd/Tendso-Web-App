"use client"

import Link from "next/link"
import { Home, Users, Plus, Wallet, User } from "lucide-react"

type NavKey = "home" | "referral" | "wallet" | "profile"

interface BottomNavProps {
    active: NavKey
}

export function BottomNav({ active }: BottomNavProps) {
    const itemClass = (key: NavKey) =>
        `flex flex-col items-center gap-0.5 py-1.5 px-2 transition-colors ${
            active === key
                ? "text-amber-500"
                : "text-zinc-500 hover:text-zinc-900"
        }`

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 pb-4 z-50">
            <nav className="flex items-end justify-around px-2 pt-2 max-w-md mx-auto">
                <Link href="/dashboard" className={itemClass("home")}>
                    <Home className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Home</span>
                </Link>
                <Link href="/referrals" className={itemClass("referral")}>
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Referral</span>
                </Link>
                <Link
                    href="/submit/info"
                    className="w-14 h-14 -mt-6 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-amber-500/40 hover:shadow-xl hover:shadow-amber-500/50 transition-all shrink-0"
                >
                    <Plus className="w-7 h-7" />
                </Link>
                <Link href="/wallet" className={itemClass("wallet")}>
                    <Wallet className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Wallet</span>
                </Link>
                <Link href="/profile" className={itemClass("profile")}>
                    <User className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Profile</span>
                </Link>
            </nav>
        </div>
    )
}
