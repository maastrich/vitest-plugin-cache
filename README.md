# @maastrich/vitest-plugin-cache

> Skips test files whose import graph hasn't changed, and replays their last passing result.

[![npm version](https://img.shields.io/npm/v/@maastrich/vitest-plugin-cache.svg?style=flat-square)](https://www.npmjs.com/package/@maastrich/vitest-plugin-cache)
[![npm downloads](https://img.shields.io/npm/dm/@maastrich/vitest-plugin-cache.svg?style=flat-square)](https://www.npmjs.com/package/@maastrich/vitest-plugin-cache)
[![CI](https://img.shields.io/github/actions/workflow/status/maastrich/vitest-plugin-cache/ci.yml?branch=main&style=flat-square)](https://github.com/maastrich/vitest-plugin-cache/actions/workflows/ci.yml)
[![install size](https://packagephobia.com/badge?p=@maastrich/vitest-plugin-cache)](https://packagephobia.com/result?p=@maastrich/vitest-plugin-cache)
[![license](https://img.shields.io/npm/l/@maastrich/vitest-plugin-cache.svg?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/@maastrich/vitest-plugin-cache.svg?style=flat-square)](https://nodejs.org)
[![GitHub stars](https://img.shields.io/github/stars/maastrich/vitest-plugin-cache?style=flat-square)](https://github.com/maastrich/vitest-plugin-cache/stargazers)

Most test runs re-execute files that nothing touched. This plugin installs a
custom Vitest **pool** that, before running a file, hashes its entire
transitive import graph with [`@maastrich/hashup`](https://github.com/maastrich/hashup).
If that hash already has a stored **passing** result, the file is never
executed — the recorded result is replayed straight through the reporter
pipeline, in-process, without spawning a worker. Anything else is handed to a
real built-in pool (`forks` by default) and its result is stored for next time.

## Features

- **Import-graph aware** — the cache key is the hash of the file _and_
  everything it imports, transitively. Change a helper five modules deep and
  every test that reaches it re-runs.
- **Zero-spawn hits** — cached files cost no process, no thread, no transform.
- **Passing results only** — failures are never cached, so a red test always
  re-runs.
- **Watch-mode safe** — invalidated modules drop the memoized hashes.
- **Extras** — fold config files, setup files or lockfiles into every hash.
- **Drop-in** — one plugin entry; no changes to your test files.

## Installation

```bash
npm install -D @maastrich/vitest-plugin-cache
# or
pnpm add -D @maastrich/vitest-plugin-cache
# or
yarn add -D @maastrich/vitest-plugin-cache
```

Requires Node.js `>= 18`. ESM-only.

Peer dependencies are deliberately narrow — the plugin builds on Vitest's pool
API and one internal reporter hook:

| Peer     | Range    |
| -------- | -------- |
| `vitest` | `~4.1.0` |
| `vite`   | `^7.0.0` |

## Usage

### As a plugin

```ts
// vitest.config.ts
import { cache } from "@maastrich/vitest-plugin-cache";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cache()],
  test: {
    globals: true,
    environment: "node",
  },
});
```

That's it. Run your tests twice and the second run prints every unchanged file
with a `⛁` marker and a `0ms` duration — that's a replayed cache hit.

### As a pool

`cache()` works by setting `test.pool` for you. If you'd rather wire it
yourself — or you already build `test` config programmatically — import the
pool directly:

```ts
// vitest.config.ts
import { cachePool } from "@maastrich/vitest-plugin-cache/pool";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: cachePool({ pool: "threads" }),
  },
});
```

> **Don't do both.** The plugin _replaces_ `test.pool`. Pick one, and select the
> underlying runner with the `pool` option rather than Vitest's `test.pool`.

### Invalidating on config and setup files

Files that aren't imported by your tests — the Vitest config itself, a setup
file, a lockfile — are invisible to the import graph. List them in `extras` so
any change to them busts the whole cache:

```ts
cache({
  extras: ["vitest.config.ts", "vitest.setup.ts", "pnpm-lock.yaml"],
});
```

### Multiple projects

**The plugin must be registered on each project, not at the root.** Vitest does
not pass root-level `plugins` (or root `test.pool`) down to projects, so a
root-only registration silently caches nothing.

For inline projects:

```ts
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cache()],
        test: { name: "unit", include: ["**/unit/**/*.test.ts"] },
      },
      {
        plugins: [cache()],
        test: { name: "integration", include: ["**/integration/**/*.test.ts"] },
      },
    ],
  },
});
```

For projects defined as separate config files (`projects: ["packages/*"]`), add
`cache()` to each package's own `vitest.config.ts`.

One cache store and one hash cache are shared per Vitest instance, so a module
hashed for `unit` is not re-hashed for `integration`. Entries are keyed by
`<file, hash>` only — **not** by project. If two projects run the same file with
the same import graph, the second replays the first's result under its own
project name. Give projects separate `cacheDir` values if that isn't what you
want.

### Ignore the cache directory

```gitignore
.vitest-cache
```

## Options

Both `cache()` and `cachePool()` take the same options object.

| Option     | Type                   | Default         | Description                                                                               |
| ---------- | ---------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `cacheDir` | `string`               | `.vitest-cache` | Where results are stored, resolved against Vitest's `root`.                               |
| `pool`     | `"threads" \| "forks"` | `"forks"`       | Built-in pool used to actually run cache misses.                                          |
| `extras`   | `string[]`             | —               | Extra files folded into **every** file's hash. Any change to them invalidates everything. |

## How it works

1. **Hash** — for each test file, [`hashup`](https://github.com/maastrich/hashup)
   resolves the full transitive import graph (respecting `tsconfig` paths,
   package exports and conditional imports) and produces a deterministic
   SHA-256 hash of it, plus any `extras`.
2. **Look up** — the hash is looked up in the store: an in-memory map first,
   then `<cacheDir>/<path/to/test/file>/<hash>.json`. Entries older than
   **7 days** are treated as misses.
3. **Hit** — the stored `File` task tree is cloned, re-tagged with the current
   project name, prefixed with `⛁`, zeroed to `0ms`, and pushed through
   Vitest's reporter pipeline. No worker is spawned and no module is
   transformed.
4. **Miss** — the file is forwarded to a real `forks`/`threads` worker, spawned
   lazily on the first miss. If everything hits, no worker ever starts.
5. **Store** — once the worker finishes, files whose result state is `pass` are
   serialized (via [`@ungap/structured-clone`](https://github.com/ungap/structured-clone),
   so errors and non-JSON values survive) and written under their hash.
   Failures are not stored.

Watch mode: whenever Vitest reports invalidated modules, the memoized hash
graph is dropped and rebuilt — hashing is cheap (file reads, all memoized).

### Caveats

- Only **file-level** caching. A single changed line in a test file re-runs the
  whole file.
- **Impure tests are not tracked.** The hash covers source files only. Tests
  that depend on env vars, network state, the clock, or a database will happily
  replay a stale pass — put anything file-shaped into `extras`, and leave the
  plugin out where purity isn't guaranteed (`plugins: [pure ? cache() : null]`).
- Replayed durations are reported as `0ms`, so aggregate timings on a cached
  run are not comparable to a cold one.
- The replay path uses `Vitest._reportFileTask`, an internal API. That's why
  the `vitest` peer range is pinned to `~4.1.0`.

## API

```ts
import { cache, cachePool, CacheStore } from "@maastrich/vitest-plugin-cache";
import type { CachePoolOptions, CacheOptions, TestResult } from "@maastrich/vitest-plugin-cache";
```

- `cache(options?: CachePoolOptions): Plugin` — Vite plugin that installs the
  cache pool. `enforce: "post"`.
- `cachePool(options?: CachePoolOptions): PoolRunnerInitializer` — the pool
  itself, for `test.pool`. Also available from
  `@maastrich/vitest-plugin-cache/pool`.
- `CacheStore` — the underlying store (`hit`, `restore`, `save`, `clearCache`,
  `getCacheStats`). Exported for tooling; you don't need it for normal use.

To wipe the cache, delete the directory:

```bash
rm -rf .vitest-cache
```

## Contributing

Issues and PRs welcome. The repo uses [Vite+](https://viteplus.dev) — use `vp`
for everything:

```bash
vp install      # install dependencies
vp check        # format + lint + type-check
vp test         # run tests
vp pack         # build
```

`test-projects/single-project` and `test-projects/multi-project` are end-to-end
fixtures consuming the built plugin — handy to verify a change against a real
Vitest run.

## License

[MIT](./LICENSE) © [Mathis Pinsault](https://github.com/maastrich)
