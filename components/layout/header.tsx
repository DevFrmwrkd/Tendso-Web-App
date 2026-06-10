"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
    const pathname = usePathname()
    const isAuthPage = pathname === "/login" || pathname === "/signup"

    if (isAuthPage) {
        return null
    }

    return (
        <header className="border-b-2 border-zinc-900 bg-white">
            <div className="mx-auto max-w-7xl px-6 py-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center">
                        {/* White wordmark inverted to black for the light header.
                            eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/tendso-logo.png"
                            alt="Tendso"
                            width={140}
                            height={25}
                            style={{ display: "block", filter: "invert(1)" }}
                        />
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link
                            href="/dashboard"
                            className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/profile"
                            className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
                        >
                            Profile
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    )
}
