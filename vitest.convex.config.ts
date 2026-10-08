import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['__tests__/giveaway/**/*.test.ts', '__tests__/affiliates/**/*.test.ts'],
    },
});
