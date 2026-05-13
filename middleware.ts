import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
    // Called server-to-server from Convex (internal.submissions.transcribeMedia)
    // using the X-Internal-Secret header for auth — no Clerk cookie present.
    // The route handler enforces either a valid Clerk session OR a matching
    // X-Internal-Secret itself, so bypassing middleware is safe.
    '/api/transcribe',
]);

export default clerkMiddleware(async (auth, req) => {
    if (isPublicRoute(req)) {
        return;
    }
    await auth.protect();
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
