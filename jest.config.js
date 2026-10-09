/**
 * Jest config in JS, not TS, on purpose.
 *
 * As jest.config.ts this needed `ts-node`, which is not a dependency of this
 * repo — so `npm test` failed to even parse its own config and NO test in
 * __tests__ could run. Plain JS needs nothing extra. (ts-jest still compiles
 * the tests themselves; it is only the config file that had the problem.)
 */
/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/__tests__/giveaway/', '/__tests__/affiliates/', '/__tests__/knowledge/'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
}
