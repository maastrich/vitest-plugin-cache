import { EventEmitter } from "node:events";
import { createHashupCache, createResolver, hashup, type HashupCache } from "@maastrich/hashup";
import type { File, Task } from "@vitest/runner";
import type {
  PoolOptions,
  PoolWorker,
  TestProject,
  Vitest,
  WorkerRequest,
  WorkerResponse,
} from "vitest/node";
import { ForksPoolWorker, ThreadsPoolWorker } from "vitest/node";
import { CacheStore } from "../cache/cache-store.js";
import type { CachePoolOptions } from "./pool.js";

type StartRequest = Extract<WorkerRequest, { type: "start" }>;
type RunRequest = Extract<WorkerRequest, { type: "run" }>;
type FileSpec = RunRequest["context"]["files"][number];

/**
 * `Vitest._reportFileTask` is internal but is the only way to replay a
 * finished `File` through the full reporter pipeline (enqueued →
 * collected → logs → updated). Tracked against the pinned vitest
 * version in pnpm-workspace.yaml.
 */
interface VitestInternals {
  _reportFileTask(file: File): Promise<void>;
}

interface SharedCacheState {
  store: CacheStore;
  hashes: HashupCache;
  resolver: ReturnType<typeof createResolver>;
  /**
   * Serializes hashup() calls. The cache's `deps` lists are filled
   * incrementally during a walk, so a concurrent walk over a shared
   * subtree can observe a half-built closure and produce a truncated —
   * scheduling-dependent — hash. One walk at a time keeps every hash
   * deterministic; walks are cheap (fs reads + parse, all memoized).
   */
  hashQueue: Promise<unknown>;
}

// One store + hashup cache per Vitest instance, shared by every pool
// worker so a file hashed for worker A is reused by worker B.
const sharedStates = new WeakMap<Vitest, SharedCacheState>();

function getSharedState(vitest: Vitest, options: CachePoolOptions): SharedCacheState {
  let state = sharedStates.get(vitest);
  if (!state) {
    state = {
      store: new CacheStore({ cacheDir: options.cacheDir, root: vitest.config.root }),
      hashes: createHashupCache(),
      resolver: createResolver(),
      hashQueue: Promise.resolve(),
    };
    sharedStates.set(vitest, state);
  }
  return state;
}

function flagCache(task: Task): void {
  if (task.type === "suite") {
    task.tasks.forEach(flagCache);
  }
  task.name = `⛁ ${task.name}`;
  if (task.result) {
    task.result.duration = 0;
  }
}

/**
 * In-process pool worker. Cache hits are replayed straight through the
 * reporter pipeline without spawning anything; misses are delegated to
 * a real built-in worker (`forks` by default).
 */
export class CachePoolWorker implements PoolWorker {
  readonly name = "cache";
  readonly cacheFs: boolean;

  private events = new EventEmitter();
  private project: TestProject;
  private vitest: Vitest;
  private shared: SharedCacheState;
  private innerName: "threads" | "forks";
  private inner: PoolWorker | null = null;
  private innerReady: Promise<void> | null = null;
  private startRequest: StartRequest | null = null;
  private onInnerStarted: ((error?: unknown) => void) | null = null;
  private pendingHashes = new Map<string, string>();

  constructor(
    private poolOptions: PoolOptions,
    private cacheOptions: CachePoolOptions = {},
  ) {
    this.project = poolOptions.project;
    this.vitest = this.project.vitest;
    this.shared = getSharedState(this.vitest, cacheOptions);
    this.innerName = cacheOptions.pool ?? "forks";
    // Built-in forks workers always cache fetched modules on disk;
    // threads workers never do. Mirror whichever we delegate to.
    this.cacheFs = this.innerName === "forks";
  }

  on(event: string, callback: (arg: unknown) => void): void {
    this.events.on(event, callback);
  }

  off(event: string, callback: (arg: unknown) => void): void {
    this.events.off(event, callback);
  }

  deserialize(data: unknown): unknown {
    return data;
  }

  async start(): Promise<void> {
    // The inner worker is spawned lazily, on the first cache miss.
  }

  async stop(): Promise<void> {
    const inner = this.inner;
    this.inner = null;
    this.innerReady = null;
    await inner?.stop();
  }

  send(request: WorkerRequest): void {
    // The channel carries two kinds of traffic: typed worker requests
    // and birpc replies for the test worker's RPC calls. RPC traffic
    // belongs to the real worker — pass it through untouched.
    if ((request as { __vitest_worker_request__?: boolean }).__vitest_worker_request__ !== true) {
      this.inner?.send(request);
      return;
    }
    void this.handle(request).catch((error) => {
      this.events.emit("error", error);
    });
  }

  private async handle(request: WorkerRequest): Promise<void> {
    switch (request.type) {
      case "start": {
        this.startRequest = request;
        this.respond({ type: "started" });
        return;
      }
      case "run": {
        await this.handleRun(request);
        return;
      }
      case "collect": {
        // Collection has no results worth caching — always delegate.
        await this.forward(request);
        return;
      }
      case "cancel": {
        this.inner?.send(request);
        return;
      }
      case "stop": {
        if (this.inner) {
          this.inner.send(request);
        } else {
          this.respond({ type: "stopped" });
        }
        return;
      }
    }
  }

  private async handleRun(request: RunRequest): Promise<void> {
    const { context } = request;

    // Watch mode reruns: some sources changed, memoized hashes are
    // stale. Cheap to rebuild — drop everything.
    if (context.invalidates?.length) {
      this.shared.hashes.hashes.clear();
      this.shared.hashes.deps.clear();
    }

    const cold: FileSpec[] = [];
    for (const spec of context.files) {
      const hash = await this.computeHash(spec.filepath);
      const cached =
        hash !== null && (await this.shared.store.hit(spec.filepath, hash))
          ? await this.shared.store.restore(spec.filepath, hash)
          : null;

      if (cached?.result.result?.state === "pass") {
        await this.replay(cached.result);
        continue;
      }

      if (hash !== null) {
        this.pendingHashes.set(spec.filepath, hash);
      }
      cold.push(spec);
    }

    // Vitest resolves the task on the first `testfileFinished`, so
    // exactly one response must go out per run request: either ours
    // (everything was cached) or the inner worker's.
    if (cold.length === 0) {
      this.respond({ type: "testfileFinished" });
      return;
    }

    await this.forward({ ...request, context: { ...context, files: cold } });
  }

  private computeHash(filepath: string): Promise<string | null> {
    const result = this.shared.hashQueue.then(async () => {
      try {
        const { hash } = await hashup(filepath, {
          cache: this.shared.hashes,
          resolver: this.shared.resolver,
          extras: this.cacheOptions.extras,
        });
        return hash;
      } catch {
        // Unhashable file: run it, don't cache it.
        return null;
      }
    });
    this.shared.hashQueue = result;
    return result;
  }

  private async replay(file: File): Promise<void> {
    const replayed = structuredClone(file);
    replayed.projectName = this.project.name;
    flagCache(replayed);
    await this.ensureModuleGraphEntry(file.filepath);
    await (this.vitest as unknown as VitestInternals)._reportFileTask(replayed);
  }

  /**
   * A replayed file was never transformed, so no Vite environment has
   * it in its module graph. Reporters that walk the graph (the
   * @vitest/ui HTML reporter throws "Cannot find environment for
   * <file>" at run end otherwise) need at least an entry node —
   * registering the URL only resolves the id, it does not transform.
   */
  private async ensureModuleGraphEntry(filepath: string): Promise<void> {
    try {
      const environments = this.project.vite.environments;
      const registered = Object.values(environments).some((environment) =>
        environment.moduleGraph.getModuleById(filepath),
      );
      if (registered) {
        return;
      }
      const target = environments.__vitest__ ?? Object.values(environments)[0];
      await target?.moduleGraph.ensureEntryFromUrl(filepath);
    } catch {
      // Best effort — only graph-walking reporters need the entry.
    }
  }

  private async forward(request: WorkerRequest): Promise<void> {
    await this.ensureInner();
    this.inner?.send(request);
  }

  private async ensureInner(): Promise<void> {
    if (!this.innerReady) {
      this.innerReady = this.spawnInner();
    }
    await this.innerReady;
  }

  private async spawnInner(): Promise<void> {
    const Inner = this.innerName === "threads" ? ThreadsPoolWorker : ForksPoolWorker;
    const inner = new Inner(this.poolOptions);
    // Built-in workers only accept listeners once started — their
    // event target is the spawned thread/process itself.
    await inner.start();
    inner.on("message", (message) => {
      this.onInnerMessage(inner.deserialize(message));
    });
    inner.on("error", (error) => this.events.emit("error", error));
    inner.on("exit", (code) => this.events.emit("exit", code));
    this.inner = inner;

    const start = this.startRequest;
    if (!start) {
      return;
    }
    // The worker runtime dispatches on the pool name — hand the inner
    // worker its real built-in name, not "cache".
    const started = new Promise<void>((resolve, reject) => {
      this.onInnerStarted = (error) => {
        this.onInnerStarted = null;
        if (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("Failed to start inner pool worker", { cause: error }),
          );
        } else {
          resolve();
        }
      };
    });
    inner.send({
      ...start,
      context: { ...start.context, pool: this.innerName },
    });
    await started;
  }

  private onInnerMessage(message: unknown): void {
    const response =
      typeof message === "object" &&
      message !== null &&
      (message as { __vitest_worker_response__?: boolean }).__vitest_worker_response__
        ? (message as WorkerResponse)
        : null;

    if (response?.type === "started" && this.onInnerStarted) {
      // Consumed: the outer "started" was already sent to Vitest.
      this.onInnerStarted(response.error);
      return;
    }
    if (response?.type === "testfileFinished" && !response.error) {
      void this.saveResults();
    }
    // Everything else — worker responses and RPC traffic alike — goes
    // straight up to the pool runner.
    this.events.emit("message", message);
  }

  private async saveResults(): Promise<void> {
    if (this.pendingHashes.size === 0) {
      return;
    }
    const files = this.vitest.state.getFiles([...this.pendingHashes.keys()]);
    for (const file of files) {
      const hash = this.pendingHashes.get(file.filepath);
      if (hash === undefined || file.projectName !== this.project.name) {
        continue;
      }
      if (file.result?.state === "pass") {
        this.pendingHashes.delete(file.filepath);
        await this.shared.store.save(file.filepath, hash, file);
      }
    }
  }

  private respond(response: { type: "started" | "stopped" | "testfileFinished" }): void {
    this.events.emit("message", {
      __vitest_worker_response__: true,
      ...response,
    } satisfies WorkerResponse);
  }
}
