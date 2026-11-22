import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal browser for the logger: localStorage, location, and a fetch that
// behaves like Chrome for keepalive — a keepalive body over 64 KiB is rejected.
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.sessionStorage = g.localStorage;
g.location = { pathname: "/5/grade-lines", search: "" };

const delivered: string[] = [];
let requests = 0;
g.fetch = async (_url: string, init: { body: string; keepalive?: boolean }) => {
  requests += 1;
  if (init.keepalive && new TextEncoder().encode(init.body).length > 64 * 1024) {
    throw new TypeError("Failed to fetch (keepalive body over 64 KiB)");
  }
  const { entries } = JSON.parse(init.body) as { entries: { event_id: string }[] };
  delivered.push(...entries.map((e) => e.event_id));
  return { ok: true, json: async () => ({ ok: true }) };
};

/** A queued AI exchange about the size of a real placement-explain one. */
const bigEvent = (i: number) => ({
  event_id: `e${i}`,
  subject_id: "s",
  session_id: "t",
  timestamp: new Date(Date.UTC(2026, 9, 27, 12, 0, i)).toISOString(),
  event: "ai_exchange",
  scenario_id: "5",
  data: { route: "placement-explain", request: { answerText: "x".repeat(4000), question: "q".repeat(4000) }, response: { text: "y".repeat(4000) } },
});

test("a queue bigger than the keepalive limit is still fully delivered", async () => {
  const { flushLogQueue } = await import("./logger");
  // ~10 big exchanges ≈ 120 KiB — over the 64 KiB keepalive limit as one batch.
  store.set("logQueue", JSON.stringify(Array.from({ length: 10 }, (_, i) => bigEvent(i))));

  await flushLogQueue();

  assert.deepEqual(
    [...delivered].sort(),
    Array.from({ length: 10 }, (_, i) => `e${i}`).sort(),
    "every queued event reached the server"
  );
  assert.equal(JSON.parse(store.get("logQueue") ?? "[]").length, 0, "queue drained");
  assert.ok(requests >= 1);
});

const small = (id: string) => ({ ...bigEvent(0), event_id: id, data: { n: 1 } });

test("one event the server can't store doesn't block the others", async () => {
  const { flushLogQueue } = await import("./logger");
  g.fetch = async (_u: string, init: { body: string }) => {
    const ids = (JSON.parse(init.body).entries as { event_id: string }[]).map((e) => e.event_id);
    return { ok: true, json: async () => ({ ok: false, failed: ids.filter((i) => i === "b1") }) };
  };
  store.set("logQueue", JSON.stringify([small("b0"), small("b1"), small("b2")]));
  await flushLogQueue();
  assert.deepEqual(
    (JSON.parse(store.get("logQueue") ?? "[]") as { event_id: string }[]).map((e) => e.event_id),
    ["b1"],
    "only the unstored event is kept for retry"
  );
});

test("closing the page hands every queued event to sendBeacon, each under 64 KiB", async () => {
  const { beaconLogQueue } = await import("./logger");
  const beaconed: string[] = [];
  const sizes: number[] = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
    sendBeacon: (_u: string, blob: Blob) => {
      void blob.text().then((t) => {
        sizes.push(new TextEncoder().encode(t).length);
        beaconed.push(...(JSON.parse(t).entries as { event_id: string }[]).map((e) => e.event_id));
      });
      return true;
    },
    },
  });
  store.set("logQueue", JSON.stringify(Array.from({ length: 10 }, (_, i) => bigEvent(i))));
  beaconLogQueue();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(beaconed.length, 10, "all ten handed over");
  assert.ok(sizes.length > 1 && sizes.every((s) => s <= 64 * 1024), `chunk sizes ${sizes}`);
});

// Last: it leaves the logger in its storage-full (in-memory) mode.
test("a full browser storage keeps events in memory and still delivers them", async () => {
  const { flushLogQueue, logEvent } = await import("./logger");
  const got: string[] = [];
  g.fetch = async (_u: string, init: { body: string }) => {
    got.push(...(JSON.parse(init.body).entries as { event: string }[]).map((e) => e.event));
    return { ok: true, json: async () => ({ ok: true, failed: [] }) };
  };
  store.set("logQueue", "[]");
  const ls = g.localStorage as { setItem: (k: string, v: string) => void };
  const realSet = ls.setItem;
  ls.setItem = (k: string, v: string) => {
    if (k === "logQueue") throw new Error("QuotaExceededError");
    realSet(k, v);
  };
  try {
    await logEvent("storage_full_probe", "5", { x: 1 });
    await flushLogQueue();
  } finally {
    ls.setItem = realSet;
  }
  assert.ok(got.includes("storage_full_probe"), "event delivered despite full storage");
});
