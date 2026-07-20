import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
    '/',
    '/login(.*)',
    '/signup(.*)',
    '/forgot-password(.*)',
    '/reset-password(.*)',
    '/auth/(.*)',
    '/website/(.*)',
    '/preview/(.*)',
    '/api/webhooks(.*)',
    '/privacy-policy(.*)',
    '/terms-of-service(.*)',
    '/creators(.*)',
    '/about(.*)',
    // New NEO LAB landing surface — fully public, no Clerk gate.
    '/for-business(.*)',
    '/for-creators(.*)',
    '/knowledge(.*)',
    '/help-faq(.*)',
    '/contact(.*)',
    // Called server-to-server from Convex (internal.submissions.transcribeMedia)
    // using the X-Internal-Secret header for auth — no Clerk cookie present.
    // The route handler enforces either a valid Clerk session OR a matching
    // X-Internal-Secret itself, so bypassing middleware is safe.
    '/api/transcribe',
    // Same pattern: called server-to-server from Convex crons/actions with the
    // X-Internal-Secret header. Without these entries clerkMiddleware redirects
    // the POST to /login (307), it lands on the GET-only login page as a 405,
    // and the email silently never sends. Each handler verifies the secret
    // itself — the two /api/internal routes require it outright, the other two
    // accept "valid admin Clerk session OR secret" — so bypassing here is safe.
    '/api/internal(.*)', // send-withdrawal-status-email, send-domain-live-email
    '/api/send-payment-followup-email',
    '/api/send-completed-website-email',
]);

export default clerkMiddleware(async (auth, req) => {
    if (isPublicRoute(req)) {
        return;
    }
    // Next.js 16 renamed middleware→proxy. In the proxy runtime, a bare
    // auth.protect() resolves its redirect target to a 404 instead of the
    // sign-in page (NEXT_PUBLIC_CLERK_SIGN_IN_URL isn't available there), so
    // EVERY protected route 404'd. Redirect unauthenticated users to /login
    // explicitly so protection works again.
    const { userId } = await auth();
    if (!userId) {
        const signInUrl = new URL('/login', req.url);
        signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
        return NextResponse.redirect(signInUrl);
    }
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
