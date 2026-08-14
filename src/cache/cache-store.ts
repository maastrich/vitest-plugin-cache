import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { File } from "@vitest/runner";
import { serialize, deserialize, type SerializedRecord } from "@ungap/structured-clone";

export interface TestResult {
  testId: string;
  filePath: string;
  hash: string;
  result: File;
  timestamp: number;
  dependencies: string[];
}

type SerializedTestResult = Omit<TestResult, "result"> & {
  result: SerializedRecord;
};

export interface CacheOptions {
  cacheDir?: string;
  /**
   * Root test file paths are made relative to inside the cache
   * directory, so the on-disk tree mirrors the project instead of the
   * absolute filesystem path.
   * @default process.cwd()
   */
  root?: string;
  enableInvalidation?: boolean;
  crossProjectCache?: boolean;
}

export class CacheStore {
  private cacheDir: string;
  private root: string;
  private memoryStore = new Map<string, TestResult>();

  constructor(options: CacheOptions = {}) {
    this.root = options.root || process.cwd();
    this.cacheDir = options.cacheDir || join(this.root, ".vitest-cache");
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getTestCacheDir(testFilePath: string): string {
    const rel = relative(this.root, testFilePath);
    // A file outside the root (or on another drive) would escape the
    // cache directory through ".." segments — fall back to its absolute
    // path with the leading separator stripped.
    const safe =
      rel.startsWith("..") || isAbsolute(rel)
        ? testFilePath.replace(/^[/\\]+|^[A-Za-z]:/, "")
        : rel;
    return join(this.cacheDir, safe);
  }

  private getCacheFilePath(testFilePath: string, hash: string): string {
    return join(this.getTestCacheDir(testFilePath), `${hash}.json`);
  }

  private getCacheKey(testFilePath: string, hash: string): string {
    return `${testFilePath}:${hash}`;
  }

  private isOlderThanWeek(timestamp: number): boolean {
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp > oneWeekInMs;
  }

  private serializeTestResult(testResult: TestResult): string {
    const serialized = {
      ...testResult,
      result: serialize(testResult.result),
    };
    return JSON.stringify(serialized, null, 1);
  }

  private deserializeTestResult(content: string): TestResult {
    const parsed = JSON.parse(content) as SerializedTestResult;
    return {
      ...parsed,
      result: deserialize(parsed.result),
    };
  }

  /**
   * Restore a test result from cache (memory or disk)
   * @param testFilePath - Path to the test file
   * @param hash - Hash of the test file
   * @returns The cached test result or null if not found
   */
  async restore(testFilePath: string, hash: string): Promise<TestResult | null> {
    const cacheKey = this.getCacheKey(testFilePath, hash);

    // First check memory store
    if (this.memoryStore.has(cacheKey)) {
      return this.memoryStore.get(cacheKey)!;
    }

    // Load from disk if not in memory
    try {
      const cacheFilePath = this.getCacheFilePath(testFilePath, hash);

      if (!existsSync(cacheFilePath)) {
        console.log(`Cache file not found: ${cacheFilePath}`);
        return null;
      }

      const content = readFileSync(cacheFilePath, "utf-8");
      const result = this.deserializeTestResult(content);

      // Verify hash matches (in case file changed since cache was written)
      if (result.hash !== hash) {
        console.log(`Cache file hash mismatch: ${cacheFilePath}`);
        return null;
      }

      console.log(`Cache file loaded: ${cacheFilePath}`);
      // Store in memory for future access
      this.memoryStore.set(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Check if a cache hit exists and is valid (less than a week old)
   * @param testFilePath - Path to the test file
   * @param hash - Hash of the test file
   * @returns true if cache hit exists and is valid, false otherwise
   */
  async hit(testFilePath: string, hash: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(testFilePath, hash);

    // First check memory store
    if (this.memoryStore.has(cacheKey)) {
      const result = this.memoryStore.get(cacheKey)!;
      return !this.isOlderThanWeek(result.timestamp);
    }

    // Check disk
    try {
      const cacheFilePath = this.getCacheFilePath(testFilePath, hash);

      if (!existsSync(cacheFilePath)) {
        return false;
      }

      const content = readFileSync(cacheFilePath, "utf-8");
      const result = this.deserializeTestResult(content);

      // Verify hash matches
      if (result.hash !== hash) {
        return false;
      }

      // Check if entry is less than a week old
      const isValid = !this.isOlderThanWeek(result.timestamp);

      if (isValid) {
        // Store in memory for future access
        this.memoryStore.set(cacheKey, result);
      }

      return isValid;
    } catch {
      return false;
    }
  }

  /**
   * Save a test result to cache (memory and disk)
   * @param testFilePath - Path to the test file
   * @param hash - Hash of the test file
   * @param result - The test result to cache
   */
  async save(testFilePath: string, hash: string, result: File): Promise<void> {
    const cacheKey = this.getCacheKey(testFilePath, hash);

    const testResult: TestResult = {
      testId: testFilePath,
      filePath: testFilePath,
      hash,
      result,
      timestamp: Date.now(),
      dependencies: [], // Could be populated with actual dependencies if needed
    };

    // Store in memory immediately for fast access
    this.memoryStore.set(cacheKey, testResult);

    // Write to disk
    try {
      const cacheDir = this.getTestCacheDir(testFilePath);
      const cacheFilePath = this.getCacheFilePath(testFilePath, hash);

      // Ensure cache directory exists
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      const serializedContent = this.serializeTestResult(testResult);
      writeFileSync(cacheFilePath, serializedContent);
    } catch {
      // Silently fail - cache is optional
    }
  }

  clearCache(testFilePath?: string): void {
    if (testFilePath) {
      // Clear from memory store
      const keysToDelete = Array.from(this.memoryStore.keys()).filter((key) =>
        key.startsWith(`${testFilePath}:`),
      );
      keysToDelete.forEach((key) => {
        this.memoryStore.delete(key);
      });

      // Clear from disk
      const cacheDir = this.getTestCacheDir(testFilePath);
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    } else {
      // Clear entire cache
      this.memoryStore.clear();

      if (existsSync(this.cacheDir)) {
        rmSync(this.cacheDir, { recursive: true, force: true });
      }
    }
  }

  getCacheStats() {
    return {
      cacheDir: this.cacheDir,
      exists: existsSync(this.cacheDir),
      memoryEntries: this.memoryStore.size,
    };
  }
}
