// Convex auth — Clerk JWT issuer domain.
//
// Reads from CLERK_JWT_ISSUER_DOMAIN env var so each Convex deployment can
// point at the right Clerk instance:
//   - dev   Convex → set to "https://upright-cardinal-15.clerk.accounts.dev"
//   - prod  Convex → set to your production Clerk issuer URL
//     (find it in Clerk dashboard → API Keys → "Issuer" field, OR
//     JWT Templates → "convex" template → "Issuer URL")
//
// applicationID must match the Clerk JWT template name. We use "convex"
// by Convex+Clerk convention; if the JWT template in Clerk has a different
// name, change it here AND in the Clerk dashboard.
export default {
    providers: [
        {
            domain:
                process.env.CLERK_JWT_ISSUER_DOMAIN ||
                "https://upright-cardinal-15.clerk.accounts.dev",
            applicationID: "convex",
        },
    ],
};
