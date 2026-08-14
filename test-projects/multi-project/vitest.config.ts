import { cache } from "@maastrich/vitest-plugin-cache";
import { defineConfig } from "vitest/config";

// The plugin must be registered on each project: Vitest does not pass
// root-level `plugins` (nor root `test.pool`) down to projects.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cache()],
        test: {
          name: "unit",
          include: ["src/unit/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
      },
      {
        plugins: [cache()],
        test: {
          name: "integration",
          include: ["src/integration/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
      },
      {
        plugins: [cache()],
        test: {
          name: "e2e",
          include: ["src/e2e/**/*.test.ts"],
          globals: true,
          environment: "node",
        },
      },
    ],
  },
});
