import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "../src/index.ts";

// ---------- keys ----------
test("stable keys are deterministic, separator-safe and 128-bit; random keys differ", () => {
  assert.equal(K.stableKey("gen", "a", 1), K.stableKey("gen", "a", 1));
  assert.notEqual(K.stableKey("gen", "ab", "c"), K.stableKey("gen", "a", "bc"));
  assert.match(K.stableKey("gen", "x"), /^gen:[0-9a-f]{32}$/);
  assert.notEqual(K.newKey("s"), K.newKey("s"));
  assert.match(K.newKey("s"), /^s:[0-9a-f-]{36}$/);
});

// ---------- http ----------
const memStore = (t: K.Tokens | null) => { let cur = t; return { get: async () => cur, set: async (n: K.Tokens) => { cur = n; }, clear: async () => { cur = null; }, peek: () => cur }; };
const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("fails over to the next base on a network error and on 502/503/504", async () => {
  const calls: string[] = [];
  const f = (async (url: string) => { calls.push(url); if (url.startsWith("https://a")) throw new TypeError("down"); if (url.startsWith("https://b")) return res(503); return res(200, { ok: true }); }) as unknown as typeof fetch;
  const c = K.createClient({ bases: ["https://a/api/", "https://b/api", "https://c/api"], fetch: f, tokens: memStore({ access: "t", refresh: "r" }) });
  assert.deepEqual(await c.request("/ping/"), { ok: true });
  assert.deepEqual(calls, ["https://a/api/ping/", "https://b/api/ping/", "https://c/api/ping/"]);
});

test("throws a network error after every base fails", async () => {
  const f = (async () => { throw new TypeError("down"); }) as unknown as typeof fetch;
  const c = K.createClient({ bases: ["https://a", "https://b"], fetch: f, tokens: memStore(null) });
  await assert.rejects(c.request("/x/"), /Network error calling \/x\/ \(2 attempts\)/);
});

test("401 triggers a single shared refresh, then the request is repeated with the new token", async () => {
  let refreshCalls = 0; const store = memStore({ access: "old", refresh: "r1" });
  const f = (async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/token/refresh/")) { refreshCalls++; await new Promise((r) => setTimeout(r, 10)); return res(200, { access: "new", refresh: "r2" }); }
    return (init.headers as Record<string, string>).Authorization === "Bearer new" ? res(200, { ok: 1 }) : res(401);
  }) as unknown as typeof fetch;
  const c = K.createClient({ bases: ["https://a"], fetch: f, tokens: store });
  const [x, y] = await Promise.all([c.request("/me/"), c.request("/stats/")]);
  assert.deepEqual([x, y], [{ ok: 1 }, { ok: 1 }]);
  assert.equal(refreshCalls, 1);                         // concurrent 401s share one refresh
  assert.deepEqual(store.peek(), { access: "new", refresh: "r2" });
});

test("failed refresh clears tokens; error bodies become ApiError with the backend message", async () => {
  const store = memStore({ access: "old", refresh: "bad" });
  const f = (async (url: string) => (url.endsWith("/auth/token/refresh/") ? res(401) : res(401))) as unknown as typeof fetch;
  const c = K.createClient({ bases: ["https://a"], fetch: f, tokens: store });
  await assert.rejects(c.request("/me/"), (e: unknown) => e instanceof K.ApiError && e.status === 401);
  assert.equal(store.peek(), null);
  const f2 = (async () => res(400, { detail: "Bad input" })) as unknown as typeof fetch;
  const c2 = K.createClient({ bases: ["https://a"], fetch: f2, tokens: memStore({ access: "t", refresh: "r" }) });
  await assert.rejects(c2.request("/x/", { method: "POST", body: {} }), (e: unknown) => e instanceof K.ApiError && e.status === 400 && e.message === "Bad input");
});

test("identical concurrent GETs are coalesced into one network call", async () => {
  let n = 0; const f = (async () => { n++; await new Promise((r) => setTimeout(r, 10)); return res(200, { v: n }); }) as unknown as typeof fetch;
  const c = K.createClient({ bases: ["https://a"], fetch: f, tokens: memStore({ access: "t", refresh: "r" }) });
  const [a, b] = await Promise.all([c.get("/list/"), c.get("/list/")]);
  assert.deepEqual(a, b); assert.equal(n, 1);
});

// ---------- offline ----------
test("backoff doubles from 500 ms and caps at 8 s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map((n) => K.backoffFor(n)), [500, 1000, 2000, 4000, 8000, 8000, 8000]);
});

test("outbox outcomes: 2xx sent, 408/429/5xx/network retry, other 4xx discard", async () => {
  assert.equal(K.classify(200), "sent"); assert.equal(K.classify(201), "sent");
  for (const s of [0, 408, 429, 500, 503]) assert.equal(K.classify(s), "retry");
  for (const s of [400, 401, 404, 422]) assert.equal(K.classify(s), "discard");
  const rows = [1, 2, 3, 4].map((id) => ({ id, kind: "flashcard_review", payload: {}, attempts: 0 }));
  const statuses: Record<number, number> = { 1: 200, 2: 503, 3: 422, 4: 0 };
  const r = await K.drain(rows, async (row) => { if (row.id === 4) throw new Error("offline"); return statuses[row.id]; });
  assert.deepEqual([r.sent, r.retry, r.discarded], [1, 2, 1]);
  assert.deepEqual(r.remaining.map((x) => [x.id, x.attempts]), [[2, 1], [4, 1]]);
});

test("prefetch interval, offline window and chunk validation", () => {
  const H = 3600_000;
  assert.equal(K.shouldPrefetch(null, 1000), true);
  assert.equal(K.shouldPrefetch(0, 23 * H), false); assert.equal(K.shouldPrefetch(0, 24 * H), true);
  assert.equal(K.offlineRemainingMs(null, 5), 24 * H); assert.equal(K.offlineRemainingMs(0, 10 * H), 14 * H); assert.equal(K.offlineRemainingMs(0, 30 * H), 0);
  assert.equal(K.chunkMatches({ version: 7, index: 2 }, { version: "7", index: 2 }), true);
  assert.equal(K.chunkMatches({ version: 7, index: 2 }, { version: 7, index: 3 }), false);
});

// ---------- session ----------
test("timer: unstarted = total, running counts down, paused freezes, never negative", () => {
  const base = { totalSeconds: 600, startedAt: 0, pausedAt: null as number | null, now: 0 };
  assert.equal(K.remainingSeconds({ ...base, startedAt: null }), 600);
  assert.equal(K.remainingSeconds({ ...base, now: 90_500 }), 510);
  assert.equal(K.remainingSeconds({ ...base, pausedAt: 100_000, now: 500_000 }), 500);
  assert.equal(K.remainingSeconds({ ...base, now: 9_999_000 }), 0);
});

test("battle clock skew and exam length helpers", () => {
  const skew = K.computeSkew(1_000_000, 990_000);              // server is 10 s ahead
  assert.equal(skew, 10_000);
  assert.equal(K.remainingFromEndsAt(1_030_000, 995_000, skew), 25);
  assert.equal(K.remainingFromEndsAt(1_000_000, 995_000, skew), 0);
  assert.equal(K.estimateMinutes(100), 84); assert.equal(K.estimateMinutes(20), 17);
  assert.equal(K.formatMinutesSeconds(65), "1:05"); assert.equal(K.formatMinutesSeconds(-1), "--");
});

// ---------- labels ----------
test("readiness, difficulty, diagnostic and Bloom buckets", () => {
  assert.equal(K.readiness(85).label, "Board-ready momentum"); assert.equal(K.readiness(75).tone, "green");
  assert.equal(K.readiness(60).tone, "amber"); assert.equal(K.readiness(59.9).label, "Recovery mode");
  assert.equal(K.caseReadiness(80), "Strong on this case"); assert.equal(K.caseReadiness(59), "Worth revisiting");
  assert.deepEqual([40, 60, 80, 81].map(K.difficultyLabel), ["Likely very hard", "Likely hard", "Balanced challenge", "Likely easy"]);
  assert.deepEqual([39, 40, 60, 80].map(K.diagnosticLevel), ["starting", "building", "solid", "strong"]);
  assert.deepEqual((["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"] as K.Bloom[]).map(K.bloomBucket), ["recall", "recall", "apply", "apply", "judgment", "judgment"]);
  assert.equal(K.hasEnoughEvidence(4), false); assert.equal(K.hasEnoughEvidence(5), true);
  assert.deepEqual([1, 7, 8, 365].map(K.streakVariant), ["started", "milestone", "extended", "milestone"]);
});

// ---------- rank ----------
test("rank tiers: starts follow the stars, mapping is consistent", () => {
  assert.deepEqual(K.TIER_STARTS, [0, 4, 8, 12, 16, 20, 25, 30, 35]);
  assert.equal(K.tierName(0), "Student II"); assert.equal(K.starsOf(3), 3); assert.equal(K.tierName(4), "Student I");
  assert.equal(K.tierName(24), "Topnotcher III"); assert.equal(K.starsOf(24), 4); assert.equal(K.tierName(25), "Topnotcher II");
  assert.equal(K.tierName(35), "Apex Topnotcher"); assert.equal(K.starsOf(99), 0); assert.equal(K.tierName(-5), "Student II");
  for (let p = 0; p < 60; p++) assert.ok(K.tierOf(p + 1) >= K.tierOf(p));
});

test("battle result rule (design): win + bonuses, loss floors at zero; combo multiplier", () => {
  assert.equal(K.applyBattleResult(10, { won: true, winStreak: 0, flawless: false }), 11);
  assert.equal(K.applyBattleResult(10, { won: true, winStreak: 3, flawless: true }), 13);
  assert.equal(K.applyBattleResult(0, { won: false, winStreak: 0, flawless: false }), 0);
  assert.equal(K.applyBattleResult(5, { won: false, winStreak: 0, flawless: false }), 4);
  assert.deepEqual([0, 1, 2, 4, 20].map((s) => K.comboMultiplier(s)), [1, 1, 1.2, 1.6, 2]);
});

// ---------- flashcards and manila ----------
test("flashcard queue, mastery and shuffle", () => {
  assert.deepEqual(K.advanceQueue(["a", "b", "c", "d", "e"], "good"), ["b", "c", "d", "e"]);
  assert.deepEqual(K.advanceQueue(["a", "b", "c", "d", "e"], "again"), ["b", "c", "d", "a", "e"]);
  assert.deepEqual(K.advanceQueue(["a", "b"], "hard"), ["b", "a"]);
  assert.deepEqual(K.masteryStats(["good", "easy", "again", "hard"]), { mastered: 2, learning: 2, percent: 50 });
  assert.equal(K.masteryStats([]).percent, 0);
  const out = K.shuffled([1, 2, 3, 4, 5], () => 0.3); assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test("Manila day clock", () => {
  const t = Date.parse("2026-01-01T17:00:00Z");              // already Jan 2 in Manila
  assert.equal(K.manilaDay(t), "2026-01-02");
  assert.equal(K.msUntilNextManilaDay(Date.parse("2026-01-01T15:59:00Z")), 60_000);   // 23:59 in Manila
  assert.equal(K.daysUntil("2026-01-12", t), 10);
});
