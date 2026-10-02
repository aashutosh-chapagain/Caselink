import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/tests/setup.ts'],
        testTimeout: 20000,
        // run test files sequentially — each file shares the same in-memory MongoDB
        pool: 'forks',
        fileParallelism: false,
    },
});
