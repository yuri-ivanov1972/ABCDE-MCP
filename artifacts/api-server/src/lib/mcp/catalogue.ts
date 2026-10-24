import {
  asRecord,
  matchesFilters,
  normalizeProduct,
  type NormalizedProduct,
  type SearchFilters,
  type Store,
} from "./domain";
import { consumeUpstreamBudget } from "./metrics";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const TOOL_DEADLINE_MS = 30_000;
const MAX_PAGES = 3;
const PAGE_SIZE = 100;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const CACHE_MAX_BYTES = 5 * 1024 * 1024;

export type CatalogueFailureKind =
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "unavailable";

export class CatalogueError extends Error {
  constructor(
    readonly kind: CatalogueFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "CatalogueError";
  }
}

export interface SearchResult {
  products: NormalizedProduct[];
  query: string | null;
  partial: boolean;
  pages_scanned: number;
  candidate_count: number;
  has_more_candidates: boolean | null;
  coverage_note: string;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  bytes: number;
}

interface InflightEntry {
  controller: AbortController;
  promise: Promise<unknown>;
  consumers: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, InflightEntry>();
let cachedBytes = 0;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("request_cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export class UpstreamGate {
  private active = 0;
  private nextStart = 0;
  private readonly queue: Array<{
    signal: AbortSignal;
    resolve: (release: () => void) => void;
    reject: (error: Error) => void;
    onAbort: () => void;
  }> = [];

  constructor(
    private readonly beforeStart: () => Promise<void> = consumeUpstreamBudget,
    private readonly intervalMs = 500,
    private readonly concurrency = 2,
    private readonly maxQueue = 50,
  ) {}

  async run<T>(signal: AbortSignal, request: () => Promise<T>): Promise<T> {
    const release = await this.acquire(signal);
    try {
      const scheduledStart = Math.max(Date.now(), this.nextStart);
      this.nextStart = scheduledStart + this.intervalMs;
      const waitMs = Math.max(0, scheduledStart - Date.now());
      if (waitMs > 0) await sleep(waitMs, signal);
      if (signal.aborted) throw signal.reason;
      try {
        await this.beforeStart();
      } catch (error) {
        throw new CatalogueError(
          error instanceof Error && error.message === "upstream_budget_exhausted"
            ? "rate_limited"
            : "unavailable",
          "shared_upstream_budget_unavailable",
        );
      }
      if (signal.aborted) throw signal.reason;
      return await request();
    } finally {
      release();
    }
  }

  private acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (this.active < this.concurrency) {
      this.active += 1;
      return Promise.resolve(this.makeRelease());
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new CatalogueError("rate_limited", "queue_full"));
    }

    return new Promise((resolve, reject) => {
      const entry = {
        signal,
        resolve,
        reject,
        onAbort: () => undefined,
      };
      entry.onAbort = () => {
        const index = this.queue.indexOf(entry);
        if (index >= 0) this.queue.splice(index, 1);
        reject(signal.reason ?? new Error("request_cancelled"));
      };
      signal.addEventListener("abort", entry.onAbort, { once: true });
      this.queue.push(entry);
    });
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.drain();
    };
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) return;
      entry.signal.removeEventListener("abort", entry.onAbort);
      if (entry.signal.aborted) {
        entry.reject(entry.signal.reason ?? new Error("request_cancelled"));
        continue;
      }
      this.active += 1;
      entry.resolve(this.makeRelease());
    }
  }
}

const upstreamGate = new UpstreamGate();

function upstreamBase(): URL {
  const configured = process.env.ABCDE_API_URL ?? "https://abcde.lv/api";
  let base: URL;
  try {
    base = new URL(configured.endsWith("/") ? configured : `${configured}/`);
  } catch {
    throw new CatalogueError("unavailable", "invalid_upstream_configuration");
  }
  if (base.protocol !== "https:" || base.username || base.password) {
    throw new CatalogueError("unavailable", "invalid_upstream_configuration");
  }
  return base;
}

function getUrl(relativePath: string, params?: URLSearchParams): URL {
  const base = upstreamBase();
  const url = new URL(relativePath.replace(/^\/+/, ""), base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new CatalogueError("unavailable", "invalid_upstream_path");
  }
  if (params) url.search = params.toString();
  return url;
}

function getCache(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    cachedBytes -= entry.bytes;
    return undefined;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function setCache(key: string, value: unknown, bytes: number): void {
  if (bytes > CACHE_MAX_BYTES) return;
  const prior = cache.get(key);
  if (prior) {
    cachedBytes -= prior.bytes;
    cache.delete(key);
  }
  cache.set(key, { value, bytes, expiresAt: Date.now() + CACHE_TTL_MS });
  cachedBytes += bytes;
  while (
    cache.size > CACHE_MAX_ENTRIES ||
    cachedBytes > CACHE_MAX_BYTES
  ) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = cache.get(oldestKey);
    cache.delete(oldestKey);
    cachedBytes -= oldest?.bytes ?? 0;
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.includes("application/json") && !type.includes("+json")) {
    throw new CatalogueError("invalid_response", "upstream_not_json");
  }
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new CatalogueError("invalid_response", "upstream_response_too_large");
  }
  if (!response.body) {
    throw new CatalogueError("invalid_response", "upstream_empty_response");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new CatalogueError(
          "invalid_response",
          "upstream_response_too_large",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(joined)) as unknown;
  } catch {
    throw new CatalogueError("invalid_response", "upstream_invalid_json");
  }
}

function retryDelay(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, TOOL_DEADLINE_MS);
  }
  const date = Date.parse(retryAfter);
  return Number.isFinite(date)
    ? Math.max(0, Math.min(date - Date.now(), TOOL_DEADLINE_MS))
    : null;
}

export async function performGet(
  url: URL,
  signal: AbortSignal,
  dependencies: {
    gate: Pick<UpstreamGate, "run">;
    fetcher: typeof fetch;
    timeoutMs?: number;
    retryWaitMs?: number;
  } = { gate: upstreamGate, fetcher: fetch },
): Promise<{ value: unknown; bytes: number }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal.aborted) throw signal.reason;
    let timedOut = false;
    try {
      const outcome = await dependencies.gate.run<
        { value: unknown; bytes: number } | { retryMs: number }
      >(signal, async () => {
        const attemptController = new AbortController();
        const timeout = setTimeout(() => {
          timedOut = true;
          attemptController.abort(new Error("upstream_timeout"));
        }, dependencies.timeoutMs ?? UPSTREAM_TIMEOUT_MS);
        const onAbort = () =>
          attemptController.abort(signal.reason ?? new Error("request_cancelled"));
        signal.addEventListener("abort", onAbort, { once: true });
        try {
          const response = await dependencies.fetcher(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: attemptController.signal,
          });
          if (response.status === 404) {
            await response.body?.cancel();
            throw new CatalogueError("not_found", "product_not_found");
          }
          if (response.status === 429) {
            const delay = retryDelay(response);
            await response.body?.cancel();
            if (attempt === 0 && delay !== null && delay < TOOL_DEADLINE_MS) {
              return { retryMs: delay } as const;
            }
            throw new CatalogueError("rate_limited", "upstream_rate_limited");
          }
          if (response.status >= 500) {
            await response.body?.cancel();
            if (attempt === 0) {
              return { retryMs: dependencies.retryWaitMs ?? 250 } as const;
            }
            throw new CatalogueError("unavailable", "upstream_server_error");
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new CatalogueError("unavailable", "upstream_request_failed");
          }
          const value = await readBoundedJson(response);
          return {
            value,
            bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
          };
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener("abort", onAbort);
        }
      });
      if ("retryMs" in outcome) {
        await sleep(outcome.retryMs, signal);
        continue;
      }
      return outcome;
    } catch (error) {
      if (error instanceof CatalogueError) throw error;
      if (signal.aborted) throw signal.reason ?? error;
      if (attempt === 0) {
        await sleep(dependencies.retryWaitMs ?? 250, signal);
        continue;
      }
      throw new CatalogueError(
        timedOut ? "timeout" : "unavailable",
        timedOut ? "upstream_timeout" : "upstream_network_error",
      );
    }
  }
  throw new CatalogueError("unavailable", "upstream_request_failed");
}

function joinInflight(
  key: string,
  entry: InflightEntry,
  signal: AbortSignal,
): Promise<unknown> {
  entry.consumers += 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      entry.consumers -= 1;
      if (entry.consumers === 0 && inflight.get(key) === entry) {
        entry.controller.abort(new Error("all_callers_cancelled"));
      }
    };
    const onAbort = () => {
      release();
      reject(signal.reason ?? new Error("request_cancelled"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (value) => {
        if (settled) return;
        release();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        release();
        reject(error);
      },
    );
  });
}

async function getJson(
  path: string,
  params: URLSearchParams | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) throw signal.reason;
  const url = getUrl(path, params);
  const key = url.toString();
  const cached = getCache(key);
  if (cached !== undefined) return cached;

  let entry = inflight.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = performGet(url, controller.signal)
      .then(({ value, bytes }) => {
        setCache(key, value, bytes);
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === entry) inflight.delete(key);
      });
    entry = { controller, promise, consumers: 0 };
    inflight.set(key, entry);
  }
  return joinInflight(key, entry, signal);
}

export function makeToolDeadline(parent?: AbortSignal): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("tool_deadline_exceeded")),
    TOOL_DEADLINE_MS,
  );
  const abortFromParent = () =>
    controller.abort(parent?.reason ?? new Error("request_cancelled"));
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

function productListResponse(value: unknown): {
  products: unknown[];
  totalCount: number | null;
} {
  const record = asRecord(value);
  if (!Array.isArray(record.products)) {
    throw new CatalogueError("invalid_response", "upstream_shape_invalid");
  }
  const total = record.totalCount;
  return {
    products: record.products,
    totalCount:
      typeof total === "number" &&
      Number.isSafeInteger(total) &&
      total >= 0
        ? total
        : null,
  };
}

export async function searchProducts(
  query: string | undefined,
  filters: SearchFilters,
  maxResults: number,
  signal: AbortSignal,
): Promise<SearchResult> {
  const trimmedQuery = query?.trim() || undefined;
  const found: NormalizedProduct[] = [];
  let candidates = 0;
  let pagesScanned = 0;
  let totalCount: number | null = null;
  let upstreamFailure: CatalogueError | null = null;
  let stoppedEarly = false;
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (trimmedQuery) params.set("search", trimmedQuery);
    if (filters.store !== "both") params.set("store", filters.store);
    if (filters.minProtein !== undefined) {
      params.set("proteinMin", String(filters.minProtein));
    }
    if (filters.maxSugar !== undefined) {
      params.set("sugarMax", String(filters.maxSugar));
    }
    if (filters.nutriScore) params.set("nutriScores", filters.nutriScore);

    let response: { products: unknown[]; totalCount: number | null };
    try {
      response = productListResponse(
        await getJson("products", params, signal),
      );
    } catch (error) {
      if (page === 1 || found.length === 0) throw error;
      upstreamFailure =
        error instanceof CatalogueError
          ? error
          : new CatalogueError("unavailable", "upstream_request_failed");
      break;
    }

    pagesScanned += 1;
    totalCount = response.totalCount;
    let checkedThisPage = 0;
    for (const raw of response.products) {
      candidates += 1;
      checkedThisPage += 1;
      try {
        const product = normalizeProduct(raw);
        const identity = `${product.store}:${product.product_id}`;
        if (!seen.has(identity) && matchesFilters(product, filters)) {
          found.push(product);
          seen.add(identity);
        }
      } catch {
        // A malformed candidate is excluded rather than normalized from guesses.
      }
      if (found.length >= maxResults) {
        stoppedEarly =
          checkedThisPage < response.products.length ||
          (totalCount !== null && totalCount > candidates);
        break;
      }
    }

    const pageMayHaveMore =
      response.products.length === PAGE_SIZE &&
      (totalCount === null || totalCount > page * PAGE_SIZE);
    if (
      found.length >= maxResults ||
      response.products.length < PAGE_SIZE ||
      !pageMayHaveMore
    ) {
      break;
    }
  }

  const hasMore =
    upstreamFailure !== null
      ? true
      : stoppedEarly
        ? true
      : totalCount === null
        ? pagesScanned === MAX_PAGES
        : totalCount > candidates;
  const partial = hasMore || upstreamFailure !== null;
  const coverageNote = upstreamFailure
    ? "Some candidates could not be checked because the catalogue request failed. Results are partial."
    : partial
      ? "At most three pages of candidates were checked. More candidates may exist; this is not an exhaustive catalogue result."
      : "All candidates in the bounded API response were checked; this does not guarantee full catalogue coverage.";

  return {
    products: found.slice(0, maxResults),
    query: trimmedQuery ?? null,
    partial,
    pages_scanned: pagesScanned,
    candidate_count: candidates,
    has_more_candidates: hasMore,
    coverage_note: coverageNote,
  };
}

export async function getProduct(
  store: Store,
  productId: number,
  signal: AbortSignal,
): Promise<NormalizedProduct> {
  const params = new URLSearchParams({ store });
  const value = await getJson(`products/${productId}`, params, signal);
  const product = normalizeProduct(value);
  if (product.product_id !== productId || product.store !== store) {
    throw new CatalogueError("invalid_response", "product_identity_mismatch");
  }
  return product;
}
