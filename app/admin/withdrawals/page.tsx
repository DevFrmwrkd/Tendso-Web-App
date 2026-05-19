"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import AdminLayout from "../components/AdminLayout"

/**
 * Legacy admin route — withdrawal transactions now live on /admin/payouts.
 * This file is kept so old bookmarks/links don't 404, and to give a one-stop
 * landing for anyone navigating directly. Redirects immediately.
 */
export default function WithdrawalsRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/admin/payouts")
    }, [router])

    return (
        <AdminLayout>
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm font-medium text-gray-700">Redirecting to Payout Management…</p>
                <p className="text-xs text-gray-500 max-w-sm">
                    Creator withdrawal transactions are now displayed under <span className="font-semibold">Payouts</span>.
                </p>
            </div>
        </AdminLayout>
    )
}
