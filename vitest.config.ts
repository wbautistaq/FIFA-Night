import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"], environment: "node" },
});
