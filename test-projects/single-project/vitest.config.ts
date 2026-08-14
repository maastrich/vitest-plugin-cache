import { cache } from "@maastrich/vitest-plugin-cache";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cache()],
  test: {
    globals: true,
    environment: "node",
    // Verbose reporting makes the ⛁ cache-hit markers visible; the
    // default reporter collapses passing test names.
    reporters: ["verbose"],
  },
});
