import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Quiz, checkQuiz } from "./quiz.js";

// API key stays on the server. Never ship it inside an app bundle.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GenerateOptions {
  sourceText: string;     // the deck / notes the quiz must be based on
  weakCards: string[];    // cards the learner recently got wrong
  recentPrompts: string[]; // prompts already asked (to avoid repeats)
  count: number;
  level: 1 | 2 | 3 | 4 | 5;
  model?: string;         // default: fast + cheap
}

const SYSTEM = [
  "You write quizzes for a flashcard app.",
  "Use ONLY the supplied source text. If a fact is not in it, do not ask about it.",
  "Mix question types. Include the learner's weak cards.",
  "Never repeat or paraphrase prompts from the 'already asked' list.",
  "For cloze questions mark blanks as {{1}}, {{2}} ... and list each blank's answer.",
  "Every explanation is one or two sentences.",
].join("\n");

export async function generateQuiz(o: GenerateOptions): Promise<Quiz> {
  const user =
    `SOURCE:\n${o.sourceText}\n\nWEAK CARDS:\n${o.weakCards.join("\n")}\n\n` +
    `ALREADY ASKED:\n${o.recentPrompts.join("\n")}\n\nWrite ${o.count} questions at difficulty ${o.level}/5.`;

  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      model: o.model ?? "claude-haiku-5-5", // use claude-sonnet-5-5 for harder subjects
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: user + feedback }],
      tools: [{ name: "submit_quiz", description: "Return the finished quiz", input_schema: zodToJsonSchema(Quiz) as Anthropic.Tool.InputSchema }],
      tool_choice: { type: "tool", name: "submit_quiz" },
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const parsed = Quiz.safeParse(block && block.type === "tool_use" ? block.input : undefined);
    if (!parsed.success) { feedback = `\n\nYour last output failed validation: ${parsed.error.message.slice(0, 400)}`; continue; }
    const problems = checkQuiz(parsed.data, o.recentPrompts);
    if (problems.length === 0) return parsed.data;
    feedback = `\n\nFix these problems: ${problems.join("; ")}`;
  }
  throw new Error("quiz generation failed validation 3 times");
}
