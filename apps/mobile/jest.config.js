const path = require("path");

const reactRoot = path.dirname(require.resolve("react/package.json"));
const babelRuntimeRoot = path.dirname(require.resolve("@babel/runtime/package.json"));

module.exports = {
  rootDir: __dirname,
  preset: "jest-expo",
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    // Required now that a tested screen (Wallet) renders a gesture-handler
    // component (SwipeSheet). Without it, GestureDetector throws during render.
    "react-native-gesture-handler/jestSetup",
  ],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@clerk|convex|nativewind)",
  ],
  moduleNameMapper: {
    "^react$": reactRoot,
    "^react/(.*)$": path.join(reactRoot, "$1"),
    "^@babel/runtime/(.*)$": path.join(babelRuntimeRoot, "$1"),
    "^@/(.*)$": "<rootDir>/$1",
    "^@tendso/convex-client$": "<rootDir>/__mocks__/convex/api.ts",
  },
  collectCoverageFrom: [
    "services/**/*.ts",
    "app/**/*.tsx",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};
