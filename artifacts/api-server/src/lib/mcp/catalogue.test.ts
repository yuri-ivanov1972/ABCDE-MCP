import assert from "node:assert/strict";
import test from "node:test";
import { CatalogueError, performGet, UpstreamGate } from "./catalogue";

const url = new URL("https://catalogue.example/api/products");
const jsonResponse = () => new Response('{"products":[],"totalCount":0}', {
  headers: { "content-type": "application/json" },
});
const noWaitGate = { run: async <T>(_signal: AbortSignal, action: () => Promise<T>) => action() };
const request = (fetcher: typeof fetch, signal = new AbortController().signal, timeoutMs = 100) =>
  performGet(url, signal, { gate: noWaitGate, fetcher, timeoutMs, retryWaitMs: 1 });
const isKind = (kind: string) => (error: unknown) =>
  error instanceof CatalogueError && error.kind === kind;

test("GET uses JSON accept, disallows redirects, and parses successful JSON", async () => {
  const result = await request(async (_url, options) => {
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    assert.deepEqual(options?.headers, { Accept: "application/json" });
    return jsonResponse();
  });
  assert.deepEqual(result.value, { products: [], totalCount: 0 });
});

test("404 is explicit and is never retried", async () => {
  let starts = 0;
  await assert.rejects(request(async () => {
    starts++;
    return new Response(null, { status: 404 });
  }), isKind("not_found"));
  assert.equal(starts, 1);
});

test("safe GET retries one transient network error or 5xx", async () => {
  for (const kind of ["network", "server"]) {
    let starts = 0;
    await request(async () => {
      starts++;
      if (starts === 1) {
        if (kind === "network") throw new TypeError("network unavailable");
        return new Response(null, { status: 503 });
      }
      return jsonResponse();
    });
    assert.equal(starts, 2);
  }
});

test("persistent 5xx stops after exactly two attempts", async () => {
  let starts = 0;
  await assert.rejects(request(async () => {
    starts++;
    return new Response(null, { status: 503 });
  }), isKind("unavailable"));
  assert.equal(starts, 2);
});

test("429 honors a usable Retry-After and rejects absent or excessive delay", async () => {
  let starts = 0;
  await request(async () => {
    starts++;
    return starts === 1
      ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
      : jsonResponse();
  });
  assert.equal(starts, 2);
  for (const headers of [{}, { "retry-after": "60" }]) {
    let rejectedStarts = 0;
    await assert.rejects(request(async () => {
      rejectedStarts++;
      return new Response(null, { status: 429, headers });
    }), isKind("rate_limited"));
    assert.equal(rejectedStarts, 1);
  }
});

test("invalid JSON, wrong content type, and oversized payloads are not retried", async () => {
  const factories = [
    () => new Response("<html>no</html>", { headers: { "content-type": "text/html" } }),
    () => new Response("{bad", { headers: { "content-type": "application/json" } }),
    () => new Response("{}", { headers: {
      "content-type": "application/json",
      "content-length": String(3 * 1024 * 1024),
    } }),
    () => new Response(`"${"x".repeat(2 * 1024 * 1024)}"`, {
      headers: { "content-type": "application/json" },
    }),
  ];
  for (const factory of factories) {
    let starts = 0;
    await assert.rejects(request(async () => {
      starts++;
      return factory();
    }), isKind("invalid_response"));
    assert.equal(starts, 1);
  }
});

test("timeouts retry only once and parent cancellation does not retry", async () => {
  let starts = 0;
  const blockedFetch: typeof fetch = async (_url, options) => {
    starts++;
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    });
  };
  await assert.rejects(request(blockedFetch, new AbortController().signal, 5), isKind("timeout"));
  assert.equal(starts, 2);

  starts = 0;
  const controller = new AbortController();
  const cancelled = request(blockedFetch, controller.signal);
  controller.abort(new Error("client_disconnected"));
  await assert.rejects(cancelled, /client_disconnected/);
  assert.equal(starts, 1);
});

test("gate enforces concurrency and reserves distinct request-start times", async () => {
  const gate = new UpstreamGate(async () => undefined, 20, 2, 10);
  let active = 0;
  let maxActive = 0;
  const starts: number[] = [];
  await Promise.all(Array.from({ length: 5 }, () =>
    gate.run(new AbortController().signal, async () => {
      starts.push(Date.now());
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 30));
      active--;
    }),
  ));
  assert.ok(maxActive <= 2);
  for (let index = 1; index < starts.length; index++) {
    assert.ok((starts[index] ?? 0) - (starts[index - 1] ?? 0) >= 18);
  }
});

test("gate bounds its queue and removes cancelled queued work", async () => {
  const gate = new UpstreamGate(async () => undefined, 0, 1, 1);
  let unblock!: () => void;
  const first = gate.run(new AbortController().signal, async () =>
    new Promise<void>((resolve) => { unblock = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  const queuedController = new AbortController();
  const second = gate.run(queuedController.signal, async () => undefined);
  await assert.rejects(
    gate.run(new AbortController().signal, async () => undefined),
    isKind("rate_limited"),
  );
  queuedController.abort(new Error("queued_cancelled"));
  await assert.rejects(second, /queued_cancelled/);
  const fourth = gate.run(new AbortController().signal, async () => "ok");
  unblock();
  await first;
  assert.equal(await fourth, "ok");
});

test("shared-budget failure stops before fetch and is not retried", async () => {
  let starts = 0;
  const gate = new UpstreamGate(async () => {
    throw new Error("upstream_budget_exhausted");
  }, 0);
  await assert.rejects(performGet(url, new AbortController().signal, {
    gate,
    fetcher: async () => {
      starts++;
      return jsonResponse();
    },
  }), isKind("rate_limited"));
  assert.equal(starts, 0);
});
