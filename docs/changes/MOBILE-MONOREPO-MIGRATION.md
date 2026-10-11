# Mobile monorepo migration

The existing mobile `ndm` app's current code is imported into `apps/mobile`.
The Next.js app, Astro template and authoritative Convex backend remain
at their existing root paths.

Source: `DevFrmwrkd/Tendso-Mobile-App` main commit
`ae43f41e00d797eef1ebf9b49d4921eb6cc0b63a`.

Historical commits and plans remain in the original private repository and are
not part of this public migration. The existing mobile repository remains
unchanged; archiving it can follow merge verification as a separate step.

```text
app/                         Next.js routes
convex/                      only deployable backend and generated API/types
astro-site-template/         existing website generator
apps/mobile/                 Expo app, native config and native tests
packages/convex-client/      shared client API and data-model type exports
packages/shared/             pure pricing helpers; lib/pricing stays compatible
package.json                 web app plus npm workspace configuration
package-lock.json            shared workspace dependency lockfile
```

## Backend ownership

Mobile imports `api`, `Doc` and `Id` from `@tendso/convex-client`, backed by root
`convex/_generated`. Mobile's copied schema/functions/generated API are removed.
The client package has no server deployment or separate schema.

Run Convex commands only from the repository root. A backend deploy must preserve
contracts used by already installed mobile versions and the outreach app. Tests
and shared types help new changes stay aligned; they do not update existing
native binaries automatically.

## Installation and checks

Use Node.js 22 LTS and run `npm ci` from the repository root. Keep app-specific
dependencies in their own manifests; do not force web React/Jest/Tailwind
versions onto mobile. The shared lockfile replaces mobile's nested lockfile.
The root `.npmrc` uses shallow installation so each app's direct dependencies
stay local, including mobile's React 19.1 and Tailwind 3. Keep that configuration
with the lockfile; default hoisting can make NativeWind load web's Tailwind 4.

From the repository root:

```sh
npm test
npm run check:templates
npm run test --workspace apps/mobile -- --runInBand
npm run typecheck --workspace apps/mobile
npm run bundle:check --workspace apps/mobile
```

Run the web production build with its existing web environment. Mobile bundle
exports need the mobile public environment and write only ignored local output;
they are not signed native builds or store submissions. Validate a native build
separately before the next native release.

Web TypeScript/test/lint discovery excludes the mobile workspace. Mobile keeps
its Expo aliases and native toolchain. Expo SDK 54's default Metro configuration
discovers the workspace; the NativeWind CSS input is anchored to the mobile app.
Metro additionally watches root `convex/_generated`, which lives outside the npm
workspace packages.
Metro and Jest resolve React from mobile even when a dependency is shared.
Mobile keeps its existing permissive TypeScript settings with `strictNullChecks`
enabled for the canonical Convex model's optional fields and union types.

## Environment and source uploads

Mobile uses `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` from its
own ignored environment file or existing EAS profiles. These are public bundled
values, not server secrets. Keep Clerk and Convex environments paired.

EAS commands run inside `apps/mobile`, but Git source uploads use the
repository-root `.easignore`; nested ignore files are not combined with it.
The root rules retain the root package manifest/lockfile, workspace client,
canonical Convex generated types and supporting sources. They exclude environment
files, signing material, dependency folders, generated native projects and
build/cache outputs. Private EAS values and signing credentials must use the
existing credential setup.

The app's identities, OAuth scheme, EAS project, profiles and release/version
settings are preserved. Vercel's web root and Astro tracing/runtime paths stay
unchanged. Native releases, Vercel deployments and the single Convex deployment
remain independent operations.

## Historical files

Historical mobile plans are excluded from the public workspace. They remain in
the [original private repository](https://github.com/DevFrmwrkd/Tendso-Mobile-App),
where old `ndm` paths and copied-backend instructions provide historical context.
Use the current mobile README/build guide and this guide for workspace commands.
The current build guide uses credential placeholders. Removing current files
does not erase earlier commits or rotate any existing credentials.

## References

- [Expo monorepos](https://docs.expo.dev/guides/monorepos/)
- [EAS monorepo builds](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [EAS ignore rules](https://docs.expo.dev/build-reference/easignore/)
