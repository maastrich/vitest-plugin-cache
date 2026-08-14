import { cache } from "@maastrich/vitest-plugin-cache";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cache()],
  test: {
    globals: true,
    environment: "node",
    projects: [
      {
        name: "unit",
        testMatch: ["**/unit/**/*.test.ts"],
        environment: "node",
      },
      {
        name: "integration",
        testMatch: ["**/integration/**/*.test.ts"],
        environment: "node",
      },
      // {
      //   name: "e2e",
      //   testMatch: ["**/e2e/**/*.test.ts"],
      //   environment: "node",
      // },
    ],
  },
});
