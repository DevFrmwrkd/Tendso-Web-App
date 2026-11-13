# Android builds from the mobile workspace

Install dependencies at the repository root with `npm ci`, then run native build
commands from `apps/mobile`. JavaScript bundle checks can run without signing or
releasing anything:

```sh
npm run bundle:android --workspace apps/mobile
```

## EAS cloud builds

Use the existing Expo project and signing credentials:

```sh
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

The `preview` profile produces an Android APK for direct device installation.
The `production` profile produces an Android App Bundle (AAB) for Google Play.
Production builds use the live services and EAS remote build numbers with
automatic incrementing.

Run EAS CLI from this directory so it reads the correct `app.json` and `eas.json`.
The upload also needs the monorepo root manifest/lockfile and shared API package.
Keep the repository-root `.easignore` rules when adjusting archive contents.

## Existing local native builds

Generated `android/` and `ios/` directories, SDK paths and signing files are not
committed. Preserve the original upload keystore and its backup. Do not generate
a replacement key for an existing Play application.

Generate an Android project when needed from `apps/mobile`:

```sh
npx expo prebuild --platform android
```

Prebuild can change generated native files. A fresh project does not inherit
uncommitted signing customizations from the old checkout. Restore the approved
local signing setup or use the existing EAS credentials before a release build.

If the local signing configuration reads the existing `NEGOSYO_UPLOAD_*`
variables, obtain their values privately from the existing credential store:

```powershell
$env:NEGOSYO_UPLOAD_STORE_FILE = '<existing-keystore-path>'
$env:NEGOSYO_UPLOAD_KEY_ALIAS = '<existing-key-alias>'
$env:NEGOSYO_UPLOAD_STORE_PASSWORD = '<existing-store-password>'
$env:NEGOSYO_UPLOAD_KEY_PASSWORD = '<existing-key-password>'
Set-Location apps/mobile/android
.\gradlew.bat assembleRelease --no-daemon
```

The directory command above starts at the repository root; if already inside
`apps/mobile`, use `Set-Location android`. Do not put credential values in this
guide, tracked files or shell scripts. Mobile environment files and signing
material are excluded from Git and EAS source uploads.

Typical generated output paths, relative to `apps/mobile`:

| Artifact | Gradle task | Output |
| --- | --- | --- |
| APK for direct installation | `assembleRelease` | `android/app/build/outputs/apk/release/app-release.apk` |
| AAB for Google Play | `bundleRelease` | `android/app/build/outputs/bundle/release/app-release.aab` |

A local `bundleRelease` build requires the same approved signing configuration.
Verify artifact identity, signing certificate and version code before any
separately authorized upload. Existing EAS production builds use the remote
version source; local Gradle builds use their generated native version settings.

## When a build fails

- Resolve the original signing key and password rather than replacing them.
- Confirm the Android SDK/JDK and local SDK path are configured for this machine.
- Use `npm run start --workspace apps/mobile -- --clear` after changing Metro
  layout or dependencies.
- The Metro worker limit remains in `metro.config.js` for the existing Windows
  bundle stability workaround.
- Avoid changing app identifiers, signing keys or environment selection to fix
  a workspace path issue.

Native builds and store submissions are independent from web and Convex
deployments. No build, submission or rollout is triggered by importing mobile
into this repository.
