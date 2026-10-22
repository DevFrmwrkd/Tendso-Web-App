// Mock for @tendso/convex-client — used in Jest tests.
// Provides typed stubs so tests can reference api.* without a real Convex build.

const known: Record<string, Record<string, string>> = {
  creators: { getByClerkId: "creators:getByClerkId", update: "creators:update" },
  withdrawals: {
    create: "withdrawals:create",
    getByCreator: "withdrawals:getByCreator",
  },
  earnings: { getByCreator: "earnings:getByCreator" },
  affiliates: { portal: "affiliates:portal" },
  adminAccess: { me: "adminAccess:me" },
  leads: { create: "leads:create" },
  r2: { generateUploadUrl: "r2:generateUploadUrl" },
  submissions: { getById: "submissions:getById", update: "submissions:update" },
  files: { getMultipleUrls: "files:getMultipleUrls" },
};

/** Any other `api.<module>.<fn>` resolves to the string "<module>:<fn>". */
const moduleRefs = (mod: string) => new Proxy({} as Record<string, string>, { get: (_t, fn) => `${mod}:${String(fn)}` });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: any = new Proxy(known, { get: (t, mod) => t[String(mod)] ?? moduleRefs(String(mod)) });
