import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/tests/setup.ts'],
        testTimeout: 20000,
        // run test files sequentially — mongodb-memory-server is shared across files
        pool: 'forks',
        forks: { singleFork: true },
    },
});
