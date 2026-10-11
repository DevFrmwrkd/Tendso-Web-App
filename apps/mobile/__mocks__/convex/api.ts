// Mock for @tendso/convex-client — used in Jest tests.
// Provides typed stubs so tests can reference api.* without a real Convex build.

export const api = {
  creators: { getByClerkId: "creators:getByClerkId", update: "creators:update" },
  withdrawals: {
    create: "withdrawals:create",
    getByCreator: "withdrawals:getByCreator",
  },
  earnings: { getByCreator: "earnings:getByCreator" },
};
