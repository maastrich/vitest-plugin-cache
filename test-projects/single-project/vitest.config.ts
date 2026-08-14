import { cache } from "@maastrich/vitest-plugin-cache";

// import vCache from "@raegen/vite-plugin-vitest-cache";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // plugins: [vCache()],
  plugins: [cache()],
  test: {
    globals: true,
    environment: "node",
    reporters: ["json", "verbose"],
    outputFile: "./test-output.json",
  },
});
