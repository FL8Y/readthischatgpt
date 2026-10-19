import { test } from "node:test";
import assert from "node:assert/strict";
import { FREE_DAILY_ENERGY, activeStreak, dayKey, pCorrect, percent, pickNext, readiness, recordActivity, scoreItem, spendEnergy, updateAbility } from "../src/engine.ts";

test("mcq scoring", () => {
  const it = { kind: "mcq", id: "a", options: ["x", "y", "z"], answer: 1 } as const;
  assert.deepEqual(scoreItem(it, { kind: "mcq", choice: 1 }), { earned: 1, possible: 1 });
  assert.deepEqual(scoreItem(it, { kind: "mcq", choice: null }), { earned: 0, possible: 1 });
});

test("SATA +/- rule never goes below zero and caps at the number of right answers", () => {
  const it = { kind: "sata", id: "s", options: ["a", "b", "c", "d", "e"], answers: [0, 2, 4] } as const;
  assert.deepEqual(scoreItem(it, { kind: "sata", choices: [0, 2, 4] }), { earned: 3, possible: 3 });
  assert.deepEqual(scoreItem(it, { kind: "sata", choices: [0, 1] }), { earned: 0, possible: 3 });   // +1 -1
  assert.deepEqual(scoreItem(it, { kind: "sata", choices: [1, 3] }), { earned: 0, possible: 3 });   // floor at 0
  assert.deepEqual(scoreItem(it, { kind: "sata", choices: [0, 2] }), { earned: 2, possible: 3 });
});

test("matrix and cloze give partial credit", () => {
  const m = { kind: "matrix", id: "m", rows: ["r1", "r2", "r3"], cols: ["c1", "c2"], answers: [0, 1, 1] } as const;
  assert.equal(percent(scoreItem(m, { kind: "matrix", choices: [0, 1, 0] })), 66.7);
  const c = { kind: "cloze", id: "c", blanks: [{ options: ["a", "b"], answer: 0 }, { options: ["x", "y"], answer: 1 }] } as const;
  assert.deepEqual(scoreItem(c, { kind: "cloze", choices: [0, null] }), { earned: 1, possible: 2 });
});

test("mismatched response kind throws", () => {
  const it = { kind: "mcq", id: "a", options: ["x"], answer: 0 } as const;
  assert.throws(() => scoreItem(it, { kind: "sata", choices: [0] }));
});

test("ability rises on a hard correct, falls on an easy miss, and stays bounded", () => {
  assert.ok(updateAbility(0, 1.5, true) > 0);
  assert.ok(updateAbility(0, -1.5, false) < 0);
  let t = 0; for (let i = 0; i < 200; i++) t = updateAbility(t, -3, true, 5);
  assert.ok(t <= 4);
  assert.ok(Math.abs(pCorrect(1, 1) - 0.5) < 1e-12);
  assert.ok(readiness(2) > readiness(0) && readiness(0) > readiness(-2));
});

test("adaptive pick: closest difficulty, skips seen, weak-area bonus", () => {
  const bank = [
    { id: "e", difficulty: -2, area: "A" }, { id: "m", difficulty: 0, area: "B" },
    { id: "h", difficulty: 2, area: "C" }, { id: "m2", difficulty: 0.3, area: "D" },
  ];
  assert.equal(pickNext(bank, new Set(), 0)!.id, "m");
  assert.equal(pickNext(bank, new Set(["m"]), 0)!.id, "m2");
  assert.equal(pickNext(bank, new Set(), 0, new Set(["D"]))!.id, "m2");   // 0.3 - 0.5 beats 0
  assert.equal(pickNext(bank, new Set(["e", "m", "h", "m2"]), 0), null);
});

test("simulated learner: ability estimate converges toward the true level", () => {
  const bank = Array.from({ length: 200 }, (_, i) => ({ id: "q" + i, difficulty: -3 + (6 * i) / 199, area: "A" }));
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const truth = 1.0; let theta = -1, seen = new Set<string>();
  for (let n = 0; n < 120; n++) {
    const it = pickNext(bank, seen, theta)!; seen.add(it.id);
    theta = updateAbility(theta, it.difficulty, rnd() < pCorrect(truth, it.difficulty), 0.3);
  }
  assert.ok(Math.abs(theta - truth) < 0.8, `theta=${theta}`);
});

test("dayKey depends on the timezone", () => {
  const t = new Date("2026-01-01T17:00:00Z");                       // 01:00 next day in Manila (UTC+8)
  assert.equal(dayKey(t, "UTC"), "2026-01-01");
  assert.equal(dayKey(t, "Asia/Manila"), "2026-01-02");
});

test("streak: same day no change, next day +1, missed day resets, lapsed display", () => {
  const tz = "Asia/Manila"; let s = { current: 0, best: 0, lastDay: null as string | null };
  s = recordActivity(s, new Date("2026-03-01T02:00:00Z"), tz); assert.equal(s.current, 1);
  s = recordActivity(s, new Date("2026-03-01T10:00:00Z"), tz); assert.equal(s.current, 1);      // same Manila day
  s = recordActivity(s, new Date("2026-03-02T02:00:00Z"), tz); assert.equal(s.current, 2);
  assert.equal(activeStreak(s, new Date("2026-03-03T02:00:00Z"), tz), 2);                      // still alive tomorrow
  assert.equal(activeStreak(s, new Date("2026-03-04T02:00:00Z"), tz), 0);                      // lapsed
  s = recordActivity(s, new Date("2026-03-05T02:00:00Z"), tz); assert.equal(s.current, 1); assert.equal(s.best, 2);
});

test("energy: free tier is capped per day and resets on a new day; premium unlimited", () => {
  const tz = "Asia/Manila"; let e = { used: 0, day: "" }; const t = new Date("2026-03-01T02:00:00Z");
  for (let i = 0; i < FREE_DAILY_ENERGY; i++) { const r = spendEnergy(e, t, tz, false); assert.ok(r.allowed); e = r.energy; }
  assert.equal(spendEnergy(e, t, tz, false).allowed, false);
  assert.equal(spendEnergy(e, t, tz, true).allowed, true);
  assert.equal(spendEnergy(e, new Date("2026-03-02T02:00:00Z"), tz, false).allowed, true);
});
