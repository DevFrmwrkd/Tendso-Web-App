// Mock for @tendso/convex-client — used in Jest tests.
// Provides typed stubs so tests can reference api.* without a real Convex build.

export const api = {
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
