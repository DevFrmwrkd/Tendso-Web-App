'use client'

import { useParams } from 'next/navigation'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { ErrorState } from '@/components/r1/ErrorState'

export default function WebsitePage() {
    const params = useParams()
    const submissionId = params.id as string

    // Get generated website from Convex. The id comes straight from the URL;
    // Convex validates it, and a malformed one throws to app/error.tsx.
    const website = useQuery(
        api.generatedWebsites.getBySubmissionId,
        submissionId ? { submissionId: submissionId as Id<'submissions'> } : "skip"
    )

    const loading = website === undefined
    const error = website === null ? 'Website not found' : null
    // HTML is either inline (legacy) or in file storage (htmlUrl). Load the URL
    // directly into the iframe when present; fall back to inline srcDoc.
    const htmlContent = website?.htmlContent || ''
    const htmlUrl = website?.htmlUrl


    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid #e5e7eb',
                        borderTopColor: '#2563eb',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p style={{ color: '#6b7280' }}>Loading website...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        )
    }

    // Round 1 leaves this bare iframe page as it is; only its not-found state
    // takes the Kit's error state (scope: "its not-found state is covered by
    // the Kit's error state"). `r1` opts this one block into the Round 1 look.
    // A query that throws (a malformed id) lands on app/error.tsx, the same
    // error state.
    if (error) {
        return (
            <div className="r1 flex min-h-dvh items-center justify-center px-4">
                <ErrorState what="This website" />
            </div>
        )
    }

    // Use iframe with srcdoc for proper rendering
    return (
        <iframe
            src={htmlUrl || undefined}
            srcDoc={htmlUrl ? undefined : htmlContent}
            style={{
                width: '100%',
                height: '100vh',
                border: 'none',
                margin: 0,
                padding: 0,
                display: 'block',
                position: 'fixed',
                top: 0,
                left: 0
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="Generated Website"
        />
    )
}
