'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <button
            onClick={handleLogout}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border border-zinc-100 text-amber-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors"
            title="Log out"
        >
            <LogOut className="w-4 h-4" />
        </button>
    )
}
