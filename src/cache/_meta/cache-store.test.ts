import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { File } from "@vitest/runner";
import { deserialize, serialize, type SerializedRecord } from "@ungap/structured-clone";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CacheStore, type TestResult } from "../cache-store.js";

// Disk entries store `result` in structured-clone serialized form — mirror
// what CacheStore.serializeTestResult writes.
function stringifyCacheEntry(entry: TestResult): string {
  return JSON.stringify({ ...entry, result: serialize(entry.result) });
}

// No need to mock hash modules since CacheStore no longer handles hashing

describe("CacheStore", () => {
  let cacheStore: CacheStore;
  let testCacheDir: string;

  beforeEach(() => {
    testCacheDir = join(process.cwd(), ".test-cache");
    cacheStore = new CacheStore({ cacheDir: testCacheDir });
  });

  afterEach(() => {
    // Clean up test cache directory
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should create cache directory if it doesn't exist", () => {
      expect(existsSync(testCacheDir)).toBe(true);
    });

    it("should use default cache directory when not provided", () => {
      const defaultCacheStore = new CacheStore();
      expect(defaultCacheStore.getCacheStats().cacheDir).toBe(join(process.cwd(), ".vitest-cache"));
    });

    it("should use provided cache directory", () => {
      const customDir = join(process.cwd(), "custom-cache");
      const customCacheStore = new CacheStore({ cacheDir: customDir });
      expect(customCacheStore.getCacheStats().cacheDir).toBe(customDir);

      // Clean up
      if (existsSync(customDir)) {
        rmSync(customDir, { recursive: true, force: true });
      }
    });
  });

  describe("restore", () => {
    it("should return null if cache file doesn't exist", async () => {
      const result = await cacheStore.restore("/test/file.ts", "hash1");

      expect(result).toBeNull();
    });

    it("should return null if hash doesn't match", async () => {
      // Create a cache file with different hash
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      const oldResult: TestResult = {
        testId: testFilePath,
        filePath: testFilePath,
        hash: "old-hash",
        result: createTestResult({ success: true }),
        timestamp: Date.now(),
        dependencies: [],
      };

      writeFileSync(join(cacheDir, "new-hash.json"), JSON.stringify(oldResult));

      const result = await cacheStore.restore(testFilePath, "new-hash");

      expect(result).toBeNull();
    });

    it("should return cached result if hash matches", async () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      const expectedResult: TestResult = {
        testId: testFilePath,
        filePath: testFilePath,
        hash: "expected-hash",
        result: createTestResult({ success: true, data: "test-data" }),
        timestamp: 1234567890,
        dependencies: ["dep1", "dep2"],
      };

      writeFileSync(join(cacheDir, "expected-hash.json"), stringifyCacheEntry(expectedResult));

      const result = await cacheStore.restore(testFilePath, "expected-hash");

      expect(result).toEqual(expectedResult);
    });

    it("should return null on JSON parse error", async () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(cacheDir, "hash1.json"), "invalid json");

      const result = await cacheStore.restore(testFilePath, "hash1");

      expect(result).toBeNull();
    });

    it("should return from memory if already loaded", async () => {
      const testFilePath = "/test/file.ts";
      const testResult = createTestResult({ success: true, data: "test-data" });
      const hash = "test-hash-123";

      // First save to load into memory
      await cacheStore.save(testFilePath, hash, testResult);

      // Then restore should return from memory
      const result = await cacheStore.restore(testFilePath, hash);

      expect(result).not.toBeNull();
      expect(result?.result).toEqual(testResult);
    });
  });

  describe("hit", () => {
    it("should return false if cache file doesn't exist", async () => {
      const result = await cacheStore.hit("/test/file.ts", "hash1");

      expect(result).toBe(false);
    });

    it("should return false if hash doesn't match", async () => {
      // Create a cache file with different hash
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      const oldResult: TestResult = {
        testId: testFilePath,
        filePath: testFilePath,
        hash: "old-hash",
        result: createTestResult({ success: true }),
        timestamp: Date.now(),
        dependencies: [],
      };

      writeFileSync(join(cacheDir, "new-hash.json"), JSON.stringify(oldResult));

      const result = await cacheStore.hit(testFilePath, "new-hash");

      expect(result).toBe(false);
    });

    it("should return true if cache exists and is less than a week old", async () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      const recentResult: TestResult = {
        testId: testFilePath,
        filePath: testFilePath,
        hash: "recent-hash",
        result: createTestResult({ success: true, data: "test-data" }),
        timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
        dependencies: ["dep1", "dep2"],
      };

      writeFileSync(join(cacheDir, "recent-hash.json"), stringifyCacheEntry(recentResult));

      const result = await cacheStore.hit(testFilePath, "recent-hash");

      expect(result).toBe(true);
    });

    it("should return false if cache is older than a week", async () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      const oldResult: TestResult = {
        testId: testFilePath,
        filePath: testFilePath,
        hash: "old-hash",
        result: createTestResult({ success: true, data: "test-data" }),
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 8, // 8 days ago
        dependencies: ["dep1", "dep2"],
      };

      writeFileSync(join(cacheDir, "old-hash.json"), JSON.stringify(oldResult));

      const result = await cacheStore.hit(testFilePath, "old-hash");

      expect(result).toBe(false);
    });

    it("should return false on JSON parse error", async () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      // Write invalid JSON
      writeFileSync(join(cacheDir, "hash1.json"), "invalid json");

      const result = await cacheStore.hit(testFilePath, "hash1");

      expect(result).toBe(false);
    });

    it("should return true from memory if already loaded and valid", async () => {
      const testFilePath = "/test/file.ts";
      const testResult = createTestResult({ success: true, data: "test-data" });
      const hash = "test-hash-123";

      // First save to load into memory
      await cacheStore.save(testFilePath, hash, testResult);

      // Then hit should return true from memory
      const result = await cacheStore.hit(testFilePath, hash);

      expect(result).toBe(true);
    });
  });

  describe("save", () => {
    it("should store result in memory and write to disk immediately", async () => {
      const testFilePath = "/test/file.ts";
      const testResult = createTestResult({ success: true, data: "test-data" });
      const hash = "test-hash-123";

      await cacheStore.save(testFilePath, hash, testResult);

      // Should be in memory store
      const stats = cacheStore.getCacheStats();
      expect(stats.memoryEntries).toBe(1);

      // Should be on disk immediately
      const cacheDir = join(testCacheDir, testFilePath);
      expect(existsSync(cacheDir)).toBe(true);

      const files = require("node:fs").readdirSync(cacheDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe("test-hash-123.json");
    });

    it("should write correct test result structure", async () => {
      const testFilePath = "/test/file.ts";
      const testResult = createTestResult({ success: true, data: "test-data" });
      const hash = "test-hash-123";

      await cacheStore.save(testFilePath, hash, testResult);

      const cacheDir = join(testCacheDir, testFilePath);
      const files = require("node:fs").readdirSync(cacheDir);
      const cacheFile = join(cacheDir, files[0]);
      const content = readFileSync(cacheFile, "utf-8");
      const writtenResult = JSON.parse(content) as Omit<TestResult, "result"> & {
        result: SerializedRecord;
      };

      expect(writtenResult.testId).toBe(testFilePath);
      expect(writtenResult.filePath).toBe(testFilePath);
      expect(writtenResult.hash).toBe(hash);
      expect(deserialize(writtenResult.result)).toEqual(testResult);
      expect(writtenResult.dependencies).toEqual([]);
      expect(typeof writtenResult.timestamp).toBe("number");
    });

    it("should handle errors gracefully", async () => {
      // Test with invalid file path to trigger error
      // Should not throw and fail silently
      await expect(
        cacheStore.save("", "hash", createTestResult({ data: "test" })),
      ).resolves.toBeUndefined();
    });
  });

  describe("structured clone serialization", () => {
    it("should properly serialize complex objects with structured clone", async () => {
      const testFilePath = "/test/file.ts";
      const complexResult = createTestResult({
        nested: {
          array: [1, 2, { deep: "value" }],
          map: new Map([["key", "value"]]),
          set: new Set([1, 2, 3]),
          date: new Date("2023-01-01"),
        },
        functions: () => "test", // Functions should be handled by structured clone
      });
      const hash = "complex-hash-123";

      await cacheStore.save(testFilePath, hash, complexResult);

      const restored = await cacheStore.restore(testFilePath, hash);
      expect(restored).not.toBeNull();
      expect(restored?.result).toEqual(complexResult);
    });

    it("should handle circular references with structured clone", async () => {
      const testFilePath = "/test/file.ts";
      const circularResult: any = createTestResult({ name: "test" });
      circularResult.self = circularResult; // Create circular reference
      const hash = "circular-hash-123";

      await cacheStore.save(testFilePath, hash, circularResult);

      const restored = await cacheStore.restore(testFilePath, hash);
      expect(restored).not.toBeNull();
      expect(restored?.result).toEqual(circularResult);
    });
  });

  describe("clearCache", () => {
    it("should clear specific test cache", () => {
      const testFilePath = "/test/file.ts";
      const cacheDir = join(testCacheDir, testFilePath);
      mkdirSync(cacheDir, { recursive: true });

      // Create a test file
      writeFileSync(join(cacheDir, "test.json"), "{}");

      cacheStore.clearCache(testFilePath);

      expect(existsSync(cacheDir)).toBe(false);
    });

    it("should clear entire cache when no file specified", () => {
      // Create some test cache files
      const testDir1 = join(testCacheDir, "test1.ts");
      const testDir2 = join(testCacheDir, "test2.ts");
      mkdirSync(testDir1, { recursive: true });
      mkdirSync(testDir2, { recursive: true });
      writeFileSync(join(testDir1, "hash1.json"), "{}");
      writeFileSync(join(testDir2, "hash2.json"), "{}");

      cacheStore.clearCache();

      expect(existsSync(testCacheDir)).toBe(false);
    });

    it("should handle non-existent cache directories gracefully", () => {
      expect(() => {
        cacheStore.clearCache("/non/existent/file.ts");
      }).not.toThrow();
    });
  });

  describe("getCacheStats", () => {
    it("should return cache directory and existence status", () => {
      const stats = cacheStore.getCacheStats();

      expect(stats).toEqual({
        cacheDir: testCacheDir,
        exists: true,
        memoryEntries: 0,
      });
    });

    it("should return false for existence when cache doesn't exist", () => {
      // Use a path that won't be created due to permissions or invalid path
      const nonExistentCache = new CacheStore({
        cacheDir: join(process.cwd(), "non-existent-cache"),
      });

      // Remove the directory if it was created
      if (existsSync(nonExistentCache.getCacheStats().cacheDir)) {
        rmSync(nonExistentCache.getCacheStats().cacheDir, {
          recursive: true,
          force: true,
        });
      }

      const stats = nonExistentCache.getCacheStats();

      expect(stats).toEqual({
        cacheDir: join(process.cwd(), "non-existent-cache"),
        exists: false,
        memoryEntries: 0,
      });
    });
  });

  describe("private methods", () => {
    it("should create proper cache file paths", async () => {
      const testFilePath = "/test/file.ts";
      const hash = "test-hash-123";
      await cacheStore.save(testFilePath, hash, createTestResult({ data: "test" }));

      const cacheDir = join(testCacheDir, testFilePath);
      expect(existsSync(cacheDir)).toBe(true);

      const files = require("node:fs").readdirSync(cacheDir);
      expect(files[0]).toBe("test-hash-123.json");
    });
  });

  describe("error handling", () => {
    it("should handle restore errors gracefully", async () => {
      // Test with invalid file path to trigger error
      // Should return null and fail silently
      const result = await cacheStore.restore("", "hash");

      expect(result).toBeNull();
    });
  });
});

function createTestResult(obj: any) {
  return obj as File;
}
