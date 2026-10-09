import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    test: {
        environment: 'node',
        include: ['__tests__/giveaway/**/*.test.ts', '__tests__/affiliates/**/*.test.ts', '__tests__/knowledge/**/*.test.ts', '__tests__/leads/**/*.test.ts', '__tests__/admin/**/*.test.ts'],
    },
});
