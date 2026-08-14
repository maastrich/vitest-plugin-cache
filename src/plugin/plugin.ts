import type { Plugin } from "vite";
import type {} from "vitest/config";
import { cachePool, type CachePoolOptions } from "../pool/pool.js";

export function cache(options: CachePoolOptions = {}): Plugin {
  return {
    name: "@maastrich/vitest-plugin-cache",
    enforce: "post",
    config() {
      return {
        test: {
          pool: cachePool(options),
        },
      };
    },
  };
}
