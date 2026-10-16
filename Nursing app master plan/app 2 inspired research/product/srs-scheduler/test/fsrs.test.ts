import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARAMS, Rating, State, dueQueue, isLeech, newCard, nextInterval, preview, retrievability, review } from "../src/fsrs.ts";

const T0 = new Date("2026-01-01T09:00:00Z");
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

test("retrievability is 90% when elapsed time equals stability", () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.ok(retrievability(0, 10) === 1);
  assert.ok(retrievability(40, 10) < retrievability(10, 10));
});

test("interval at 90% desired retention equals stability (rounded)", () => {
  assert.equal(nextInterval(12, DEFAULT_PARAMS), 12);
  assert.ok(nextInterval(12, { ...DEFAULT_PARAMS, desiredRetention: 0.8 }) > 12);
  assert.ok(nextInterval(12, { ...DEFAULT_PARAMS, desiredRetention: 0.95 }) < 12);
});

test("first review: Easy > Good > Hard > Again stability, difficulty ordered opposite", () => {
  const c = newCard("a", T0);
  const [a, h, g, e] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((r) => review(c, r, T0));
  assert.ok(e.stability > g.stability && g.stability > h.stability && h.stability > a.stability);
  assert.ok(a.difficulty > h.difficulty && h.difficulty > g.difficulty && g.difficulty > e.difficulty);
  assert.equal(e.state, State.Review);
  assert.equal(a.state, State.Learning);
});

test("recalling grows stability; a lapse shrinks it and counts a lapse", () => {
  let c = review(newCard("b", T0), Rating.Easy, T0); // graduates to Review
  const s0 = c.stability;
  const good = review(c, Rating.Good, c.due);
  assert.ok(good.stability > s0);
  const lapsed = review(c, Rating.Again, c.due);
  assert.ok(lapsed.stability < s0);
  assert.equal(lapsed.state, State.Relearning);
  assert.equal(lapsed.lapses, 1);
});

test("difficulty stays within 1..10 over many reviews", () => {
  let c = newCard("c", T0); let now = T0;
  for (let i = 0; i < 60; i++) { c = review(c, i % 3 === 0 ? Rating.Again : Rating.Hard, now); now = c.due; }
  assert.ok(c.difficulty >= 1 && c.difficulty <= 10);
  for (let i = 0; i < 60; i++) { c = review(c, Rating.Easy, now); now = c.due; }
  assert.ok(c.difficulty >= 1 && c.difficulty <= 10);
});

test("reviewing later than due (lower retrievability) gives a bigger stability gain", () => {
  const c = review(newCard("d", T0), Rating.Easy, T0);
  const onTime = review(c, Rating.Good, c.due);
  const late = review(c, Rating.Good, new Date(c.due.getTime() + 10 * 86_400_000));
  assert.ok(late.stability > onTime.stability);
});

test("preview returns increasing due dates Again < Hard < Good < Easy", () => {
  const c = review(newCard("e", T0), Rating.Easy, T0);
  const p = preview(c, c.due);
  assert.ok(p[Rating.Again] < p[Rating.Hard] && p[Rating.Hard] < p[Rating.Good] && p[Rating.Good] < p[Rating.Easy]);
});

test("input card is not mutated", () => {
  const c = newCard("f", T0); const copy = JSON.stringify(c);
  review(c, Rating.Good, T0);
  assert.equal(JSON.stringify(c), copy);
});

test("queue: learning first, then reviews (least remembered first), then limited new cards", () => {
  const learn = review(newCard("L", T0), Rating.Again, T0);          // due in 1 min
  const r1 = review(newCard("R1", T0), Rating.Easy, T0);
  const r2 = review(newCard("R2", T0), Rating.Easy, T0);
  r2.stability = r1.stability / 4; r2.due = r1.due;                   // R2 is forgotten sooner
  const fresh = ["N1", "N2", "N3"].map((id) => newCard(id, T0));
  const q = dueQueue([...fresh, r1, r2, learn], days(400), { newPerDay: 2, reviewsPerDay: 10 });
  assert.deepEqual(q.map((c) => c.id), ["L", "R2", "R1", "N1", "N2"]);
});

test("leech detection", () => {
  const c = { ...newCard("g", T0), lapses: 8 };
  assert.ok(isLeech(c)); assert.ok(!isLeech({ ...c, lapses: 7 }));
});
