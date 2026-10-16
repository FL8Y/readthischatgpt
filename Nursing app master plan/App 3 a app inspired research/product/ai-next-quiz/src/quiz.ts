import { z } from "zod";

/** Question types mirror the activity types seen in Gizmo's quiz engine. */
const base = {
  id: z.string(),
  prompt: z.string().min(3),
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  cardId: z.string().optional(),
};

export const Question = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("choice"), options: z.array(z.string()).min(3).max(5), answerIndex: z.number().int() }),
  z.object({ ...base, type: z.literal("typing"), answer: z.string(), acceptable: z.array(z.string()).default([]) }),
  z.object({ ...base, type: z.literal("cloze"), text: z.string(), blanks: z.array(z.object({ id: z.string(), answer: z.string() })).min(1) }),
  z.object({ ...base, type: z.literal("matching"), pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(3).max(6) }),
  z.object({ ...base, type: z.literal("ordering"), items: z.array(z.string()).min(3).max(7) }), // items given in the correct order
]);
export type Question = z.infer<typeof Question>;

export const Quiz = z.object({ title: z.string(), questions: z.array(Question).min(3).max(12) });
export type Quiz = z.infer<typeof Quiz>;

/** Semantic checks the schema cannot express. Returns a list of problems (empty = ok). */
export function checkQuiz(q: Quiz, alreadyAsked: string[] = []): string[] {
  const problems: string[] = [];
  const seen = new Set(alreadyAsked.map(norm));
  q.questions.forEach((x, i) => {
    const at = `q${i + 1}`;
    if (seen.has(norm(x.prompt))) problems.push(`${at}: repeats an earlier prompt`);
    seen.add(norm(x.prompt));
    if (x.type === "choice") {
      if (x.answerIndex < 0 || x.answerIndex >= x.options.length) problems.push(`${at}: answerIndex out of range`);
      if (new Set(x.options.map(norm)).size !== x.options.length) problems.push(`${at}: duplicate options`);
    }
    if (x.type === "cloze") {
      for (const b of x.blanks) if (!x.text.includes(`{{${b.id}}}`)) problems.push(`${at}: blank ${b.id} missing from text`);
    }
    if (x.type === "matching") {
      if (new Set(x.pairs.map((p) => norm(p.left))).size !== x.pairs.length) problems.push(`${at}: duplicate left items`);
    }
  });
  return problems;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
