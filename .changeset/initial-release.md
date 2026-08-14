---
"@maastrich/vitest-plugin-cache": minor
---

Initial release.

Caches passing Vitest test-file results on disk, keyed by a deterministic
hash of each file's import tree (powered by `@maastrich/hashup`). On the
next run, files whose sources did not change are replayed through the
reporter pipeline (marked ⛁) without spawning a worker; only cold files
are delegated to a real `forks`/`threads` pool.

- `cache()` Vite plugin: one-liner setup via `test.pool`
- `cachePool()` initializer for manual pool configuration
- `extras` option to fold config/lockfiles into every hash
- Watch-mode invalidation, per-project result isolation, 7-day expiry
