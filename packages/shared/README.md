# @tendso/shared

Client-safe, pure helpers shared by Tendso's web app, mobile app, and Convex
backend. This package has no runtime dependencies and imports no UI, storage,
authentication, environment variables, or server SDKs.

## Pricing

```ts
import { commissionFor, formatPHP, WEBSITE_PRICE } from '@tendso/shared/pricing';
```

`pricing.ts` contains the existing pricing constants and helpers, moved without
behavior changes. It includes sale and campaign calculations, commission and
domain calculations, comped-sale classification, and peso formatting. Existing
web and Convex imports through `lib/pricing.ts` remain supported by a relative
re-export.

The package exports TypeScript source directly. Consumers must use a bundler
that compiles TypeScript, such as Next, Expo/Metro, Vite, or Convex; there is no
separate package build or generated JavaScript to keep in sync. The `types`
export points at the same source. A consumer's own test runner must transform
TypeScript too. The relative compatibility entry does not require an installed
workspace symlink.

## Future shared rules

Pricing is the only export today. Existing account and referral rules can move
here in later changes when their canonical implementations and tests are
identified. Preserve their existing behavior and expose each through a clear
subpath. Authentication, authorization, database lookups, and mutations remain
in the backend; client-safe helpers do not replace server enforcement.
