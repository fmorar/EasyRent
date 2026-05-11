import { defineConfig } from "vitest/config"
import path from "node:path"

// Mirror the `@/*` path alias declared in `tsconfig.json` so Vitest can
// resolve module IDs the same way Next does at build time. Without
// this, tests that import `@/types/contracts` fail with
// "Cannot find package '@/...'".
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
})
