import { generateQuiz } from "./generate.js";
import type { Quiz } from "./quiz.js";

/** Storage the host app provides (SQL, KV, ...). Kept abstract on purpose. */
export interface Db {
  takeUnplayedQuiz(userId: string): Promise<(Quiz & { id: string }) | null>;
  countUnplayed(userId: string): Promise<number>;
  saveQuiz(userId: string, q: Quiz): Promise<Quiz & { id: string }>;
  sourceTextFor(userId: string): Promise<string>;
  weakCards(userId: string, n: number): Promise<string[]>;
  recentPrompts(userId: string, n: number): Promise<string[]>;
  levelFor(userId: string): Promise<1 | 2 | 3 | 4 | 5>;
  setLevel(userId: string, level: 1 | 2 | 3 | 4 | 5): Promise<void>;
  insertAttempt(userId: string, a: { cardId?: string; correct: boolean; ms: number }): Promise<void>;
  lastAttempts(userId: string, n: number): Promise<{ correct: boolean }[]>;
  markWeak(userId: string, cardId: string): Promise<void>;
  usersDueForDailyQuiz(now: Date): Promise<{ id: string; pushToken: string }[]>;
}
export type Push = (token: string, msg: { title: string; body: string; data: Record<string, string> }) => Promise<void>;

const BUFFER = 2; // keep this many unplayed quizzes ready (Gizmo's "refill")

export class QuizService {
  private refilling = new Set<string>();
  constructor(private db: Db, private push: Push) {}

  /** "generate": build a quiz now. */
  async refillNow(userId: string) {
    const [sourceText, weakCards, recentPrompts, level] = await Promise.all([
      this.db.sourceTextFor(userId), this.db.weakCards(userId, 8), this.db.recentPrompts(userId, 60), this.db.levelFor(userId),
    ]);
    return this.db.saveQuiz(userId, await generateQuiz({ sourceText, weakCards, recentPrompts, count: 8, level }));
  }

  /** "refill": top the buffer up in the background without blocking the request. */
  private queueRefill(userId: string) {
    if (this.refilling.has(userId)) return;
    this.refilling.add(userId);
    this.refillNow(userId).catch(console.error).finally(() => this.refilling.delete(userId));
  }

  /** Serve the next quiz; generate on demand on a cold start. */
  async nextQuiz(userId: string) {
    const quiz = await this.db.takeUnplayedQuiz(userId);
    if ((await this.db.countUnplayed(userId)) < BUFFER) this.queueRefill(userId);
    return quiz ?? (await this.refillNow(userId));
  }

  /** "fire": call from cron every few minutes; pushes users whose chosen time has arrived. */
  async fireDailyQuizzes(now = new Date()) {
    for (const u of await this.db.usersDueForDailyQuiz(now)) {
      const quiz = await this.nextQuiz(u.id);
      await this.push(u.pushToken, { title: "Your daily quiz is ready", body: quiz.title, data: { quizId: quiz.id } });
    }
  }

  /** "response": record an answer and adapt difficulty. */
  async recordAnswer(userId: string, a: { cardId?: string; correct: boolean; ms: number }) {
    await this.db.insertAttempt(userId, a);
    const recent = await this.db.lastAttempts(userId, 20);
    const acc = recent.filter((x) => x.correct).length / Math.max(1, recent.length);
    const level = await this.db.levelFor(userId);
    if (acc > 0.85 && level < 5) await this.db.setLevel(userId, (level + 1) as 1 | 2 | 3 | 4 | 5);
    if (acc < 0.55 && level > 1) await this.db.setLevel(userId, (level - 1) as 1 | 2 | 3 | 4 | 5);
    if (a.cardId && !a.correct) await this.db.markWeak(userId, a.cardId);
  }
}
