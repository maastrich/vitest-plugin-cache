import type { PoolRunnerInitializer } from "vitest/node";
import { CachePoolWorker } from "./worker.js";

export interface CachePoolOptions {
  /**
   * Directory where cached test results are stored.
   * @default ".vitest-cache"
   */
  cacheDir?: string;
  /**
   * Built-in pool used to run uncached test files.
   * @default "forks"
   */
  pool?: "threads" | "forks";
  /**
   * Additional files folded into every test file's hash (e.g. setup
   * files, vitest config, lockfile). Any change to them invalidates
   * the whole cache.
   */
  extras?: string[];
}

export function cachePool(options: CachePoolOptions = {}): PoolRunnerInitializer {
  return {
    name: "cache",
    createPoolWorker: (poolOptions) => new CachePoolWorker(poolOptions, options),
  };
}
