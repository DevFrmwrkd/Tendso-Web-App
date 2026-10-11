# Tendso mobile

The Expo SDK 54 / React Native app lives in `apps/mobile`. The existing Next.js
app and the only deployable Convex backend remain at the repository root.

## Development

Use Node.js 22 LTS and install from the repository root with the shared lockfile:

```sh
npm ci
npm run start --workspace apps/mobile
```

To clear Metro's cache after moving an existing checkout:

```sh
npm run start --workspace apps/mobile -- --clear
```

Run Android locally with `npm run android --workspace apps/mobile`; this requires
the Android SDK. Local iOS builds require macOS and Xcode. Some native features
require a development build rather than Expo Go.

Keep local mobile variables in ignored `apps/mobile/.env.local`:

- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

Use the matching Convex deployment and Clerk instance. Values prefixed
`EXPO_PUBLIC_` are bundled into the app; never use them for server secrets or
signing passwords. EAS profiles retain their existing public configuration in
`eas.json`. Root web environment files are not mobile configuration.

## Checks

Run these from the repository root:

```sh
npm run test --workspace apps/mobile -- --runInBand
npm run typecheck --workspace apps/mobile
npm run bundle:check --workspace apps/mobile
```

The bundle check exports Android and iOS JavaScript/assets into ignored
`apps/mobile/dist/`. It does not sign, upload or release a native app.

Web and mobile retain their own React, Jest and Tailwind versions. Keep mobile
dependencies in this workspace's `package.json`; update the root lockfile from
the repository root rather than creating a mobile lockfile.
Keep the root `.npmrc` with the lockfile: its shallow installation keeps mobile's
direct dependencies local, so NativeWind uses mobile's Tailwind 3.

## Shared backend

Import `api` and type-only `Doc` / `Id` from `@tendso/convex-client`. That local
workspace package exposes the root `convex/_generated` API and data model; it
does not contain a second backend. Make backend changes and regenerate types
from the repository root. Run Convex development/deployment commands there only.

Installed mobile versions keep calling the same backend. Preserve their function
names and argument contracts when changing root Convex code. Adding a workspace
does not update already installed native apps.

## Native builds and releases

Run EAS commands from `apps/mobile`, where `app.json` and `eas.json` live:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

Use the existing EAS project and signing credentials. The migration preserves
the Android package, iOS bundle identifier, OAuth scheme, versions and profiles;
do not initialize a replacement project or generate a replacement upload key.

The current Android `production` profile produces an APK. Do not assume it
produces an AAB for Google Play. See [BUILD_APK.md](BUILD_APK.md) for native build
details. Cloud builds, submissions and store rollouts remain separate release
actions; normal checks do not run them.

The repository-root `.easignore` controls monorepo Git uploads; nested ignore
files are not combined with it. It excludes environment files, signing
credentials and generated outputs while retaining the root lockfile, manifests,
shared client and canonical backend sources/types needed by the workspace. Supply
private build credentials through the existing EAS credential/environment setup.

See [the migration guide](../../docs/changes/MOBILE-MONOREPO-MIGRATION.md) for
repository layout and validation boundaries. Historical mobile plans remain in
the [original private repository](https://github.com/DevFrmwrkd/Tendso-Mobile-App).
Use this README and the build guide for current workspace commands.
