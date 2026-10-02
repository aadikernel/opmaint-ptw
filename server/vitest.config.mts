import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["tests/globalSetup.ts"],
    fileParallelism: false, // API tests share one real test database
    testTimeout: 20000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://ptw:ptw@localhost:5432/ptw_test",
      JWT_SECRET: "test-secret-not-for-production",
      RUN_EXPIRY_JOB: "false",
    },
  },
});
