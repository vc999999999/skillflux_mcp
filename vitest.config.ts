import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "skillflux-pack/tests/**/*.test.ts"],
  },
});
