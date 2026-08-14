import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite-plus";

/**
 * TypeScript 7 ships as a native binary and no longer exposes the JS compiler
 * API (`ts.sys`, `ts.createProgram`, …) that tsdown's default declaration
 * emitter relies on. Resolve the native `tsc` executable so `dts` can run in
 * `tsgo` mode instead — same binary, spawned as a process.
 */
function resolveNativeTscPath(): string {
  const require = createRequire(import.meta.url);
  const typescriptDir = dirname(require.resolve("typescript/package.json"));
  const requireFromTypescript = createRequire(`${typescriptDir}/`);
  const platformPackage = `@typescript/typescript-${process.platform}-${process.arch}`;
  const exeDir = dirname(requireFromTypescript.resolve(`${platformPackage}/package.json`));
  return join(exeDir, "lib", process.platform === "win32" ? "tsc.exe" : "tsc");
}

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["dist", "test-projects", "node_modules", "*.d.ts"],
    env: { node: true, es2024: true },
    globals: { NodeJS: "readonly" },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  pack: {
    entry: {
      index: "src/index.ts",
      pool: "src/pool/index.ts",
    },
    format: ["esm"],
    dts: { tsgo: { path: resolveNativeTscPath() } },
  },
});
