"use client"

import { useUser } from '@clerk/nextjs'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { adminClientAccess, isActiveTeamAccount } from '@/lib/admin-access'

/**
 * Wait for Clerk and Convex authentication before resolving the session's
 * own role. Staff permissions depend on the current route, including after
 * navigation inside the persistent server layout.
 */
export function useAdminAuth({ allowAccountPage = false }: { allowAccountPage?: boolean } = {}) {
    const router = useRouter()
    const pathname = usePathname()
    const { user, isLoaded } = useUser()
    const { isLoading: convexLoading, isAuthenticated } = useConvexAuth()
    const session = useQuery(
        api.adminAccess.me,
        isLoaded && user && isAuthenticated && !convexLoading ? {} : "skip"
    )
    const access = adminClientAccess({
        clerkLoaded: isLoaded,
        userId: user?.id ?? null,
        convexLoading,
        convexAuthenticated: isAuthenticated,
        session,
        pathname,
        allowAccountPage,
    })
    const creator = !access.loading && isAuthenticated && session?.clerkId === user?.id
        ? session?.creator
        : undefined
    const isAdmin = access.allowed && isActiveTeamAccount(creator) && creator?.role === 'admin'
    const isStaff = access.allowed && isActiveTeamAccount(creator) && creator?.role === 'staff'
    const redirectTo = access.redirectTo

    useEffect(() => {
        if (redirectTo) router.replace(redirectTo)
    }, [redirectTo, router])

    return { isAdmin, isStaff, canAccess: access.allowed, loading: access.loading, creator }
}

/**
 * Hook to fetch all submissions (using Convex)
 */
export function useSubmissions() {
    const { isAdmin } = useAdminAuth()

    // Get all submissions from Convex
    const submissions = useQuery(
        api.submissions.getAllWithCreator,
        isAdmin ? {} : "skip"
    )

    const loading = submissions === undefined
    const error = null

    // Transform to match expected format
    const formattedSubmissions = (submissions || []).map((s: any) => ({
        id: s._id,
        business_name: s.businessName,
        owner_name: s.ownerName,
        business_type: s.businessType,
        status: s.status,
        creator_payout: s.creatorPayout || 0,
        created_at: s._creationTime,
        reviewed_by: s.reviewedByName || null,
        creators: s.creator ? {
            first_name: s.creator.firstName,
            last_name: s.creator.lastName,
        } : null,
    }))

    const refresh = () => {
        // Convex queries auto-refresh, this is just for API compatibility
    }

    return { submissions: formattedSubmissions, loading, error, refresh }
}

/**
 * Hook to fetch single submission with creator info (using Convex)
 */
export function useSubmission(id: string) {
    const { isAdmin } = useAdminAuth()

    // We won't use this hook for now - use Convex directly in components
    return {
        submission: null,
        creator: null,
        loading: false,
        error: 'Use Convex queries directly',
        refresh: () => { }
    }
}

/**
 * Hook to update submission status (using Convex)
 */
export function useSubmissionStatus(submissionId: string) {
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const updateStatus = async (newStatus: string): Promise<boolean> => {
        // This should use Convex mutations directly in the component
        return false
    }

    return { updateStatus, updating, error }
}
