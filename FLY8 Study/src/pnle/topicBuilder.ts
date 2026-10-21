import type { Topic } from '../core/types';
import { parseFixTopics } from '../core/quiz';
import { relatedOutline } from './referenceOutline';

/**
 * Topic Builder: a complete prompt the owner pastes into ChatGPT/Claude together with ONE topic
 * name. The chat model first lists everything the exam could ask under that topic (so nothing is
 * missed), then writes one importable note per subtopic. The reply format is chosen so the
 * app's existing parser (`parseFixTopics`: one note per `# Title` line) can import it directly.
 */

export const PNLE_AREAS_TEXT = [
  'NP1 Community Health Nursing (care of individuals, families, population groups and community)',
  'NP2 Care of Mother and Adolescent + Human Growth and Development',
  'NP3 Surgery, Oxygenation, Fluids and Electrolytes, Infectious/Inflammatory/Immunologic response, Cellular aberrations',
  'NP4 Nutrition and GI, Metabolism and Endocrine, Perception and Coordination',
  'NP5 Maladaptive patterns of behavior (psychiatric) + Life-threatening, acutely ill and emergency situations',
].join('\n');

export interface TopicBuilderInput {
  /** The topic the learner wants covered, e.g. "Heart failure". Empty -> a visible placeholder. */
  topic: string;
  /** NP1..NP5 or free text. Optional. */
  area?: string;
  /** Learner's own notes on the topic. The model must build on them and flag differences. */
  notes?: string;
  /** Titles already in the library, so the model does not repeat them. */
  existingTitles?: string[];
  /** Roughly how many words per note. Default 500. */
  wordsPerNote?: number;
  /** Set when continuing a previous reply that stopped early. */
  continueFrom?: string;
  /**
   * Headings from the learner's own review deck to use as an extra coverage checklist. When
   * omitted, related headings are looked up from the built-in reference outline (NP1/NP5).
   * Pass an empty array to switch it off.
   */
  referenceOutline?: string[];
}

export const CONTINUE_MARK = 'CONTINUE-FROM:';
export const END_MARK = 'END-OF-TOPIC';

const NOTE_TEMPLATE = [
  '# <Subtopic title>',
  'Area: <NP1-NP5> | Type: <disease / concept / skill / drug class / law or ethics / program> | Exam priority: <high / medium / low>',
  '## What it is',
  '1-3 plain sentences.',
  '## Mechanism (why)',
  '- cause -> change in the body -> sign or symptom, so the findings can be derived, not memorised',
  '## Must-know facts',
  '- only facts an exam question could test',
  '## What the nurse assesses',
  '- findings and risk factors (expected vs abnormal)',
  '## Priority nursing actions',
  '1. numbered in priority order; after each, the rule that puts it there (Maslow / ABC / safety / assess before act / least invasive)',
  '## Decision rule',
  '- "If you see X, do Y first, because Z"; and the one finding that changes the order',
  '## Treatments and medications (general terms only)',
  '- drug classes and what to watch; NO doses unless you are certain they are standard',
  '## Complications and red flags',
  '- what needs immediate action or reporting',
  '## Client and family teaching',
  '- teach-back points; what shows understanding',
  '## How the exam asks about it',
  '- the trap: look-alike options and the tempting wrong action, each with its error type (wrong time, wrong client, symptom not cause, skipped assessment, out of scope)',
  '## Memory aid',
  '- a mnemonic only if genuinely useful; say if you made it up',
  '## Related topics',
  '- [[Another subtopic]], [[A topic in another area]] (exact note titles so links connect)',
  '## Check against your textbook',
  '- anything you are unsure of, beyond common textbook teaching, or possibly different in Philippine practice or policy',
].join('\n');

/** The full prompt text. Pure: same input, same output. */
export function topicBuilderPrompt(input: TopicBuilderInput): string {
  const topic = input.topic.trim() || '[WRITE YOUR TOPIC HERE]';
  const words = Math.min(900, Math.max(250, Math.round(input.wordsPerNote ?? 500)));
  const existing = (input.existingTitles ?? []).filter((t) => t.trim());
  const lines: string[] = [];

  lines.push(
    'ROLE',
    'You are a Philippine nursing licensure exam (PNLE) review writer for one nursing student. You think like a board-exam item writer: what is tested, how, and where students lose points.',
    '',
    'MY TOPIC',
    topic,
    input.area?.trim() ? `Exam area: ${input.area.trim()}` : 'Exam area: choose the best fit from the list below and say which.',
    '',
    'EXAM AREAS (best known structure; if you disagree, say so):',
    PNLE_AREAS_TEXT,
    '',
  );

  if (input.notes?.trim()) {
    lines.push(
      'MY OWN NOTES (build on them: keep what is right, fix what is wrong, list changes under "Check against your textbook"):',
      '"""',
      input.notes.trim().slice(0, 6000),
      '"""',
      '',
    );
  }
  if (existing.length) {
    lines.push(
      'NOTES I ALREADY HAVE (do not rewrite these titles; link with [[Title]] where related):',
      existing.slice(0, 80).map((t) => `- ${t}`).join('\n'),
      '',
    );
  }
  const outline = input.referenceOutline ?? relatedOutline(topic, input.area);
  if (outline.length) {
    lines.push(
      'REFERENCE COVERAGE LIST (headings from my own review deck; cover each that belongs under my topic, merge tiny ones, and say in the coverage map if one is not exam-relevant):',
      outline.slice(0, 60).map((h) => `- ${h}`).join('\n'),
      '',
    );
  }
  if (input.continueFrom?.trim()) {
    lines.push(
      `THIS IS A CONTINUATION. Skip everything already written. Start with the subtopic "${input.continueFrom.trim()}" and carry on with the rest of the coverage map. Do not repeat the coverage map.`,
      '',
    );
  }

  lines.push(
    'WHAT I WANT',
    'Cover my topic COMPLETELY so nothing the exam could ask is missed. Work in this order:',
    '1. COVERAGE MAP. Before any notes, a numbered checklist of EVERY subtopic, concept, skill, drug class, program, law and exam trap under my topic across all five exam areas: basics, assessment, priority actions, complications, teaching, ethics/legal, community and Philippine health-program angles, cross-links. Mark each high / medium / low exam priority. Add what is easy to forget.',
    '2. NOTES. One note per checklist item in the template below, most to least important. Teach mechanism first (why), then the decision rule, then the trap; keep a fact only if it is testable. Tiny items may be short; important ones about ' + words + ' words.',
    '3. SELF-AUDIT. Silently check every map item has a note. If you run out of room, stop at the end of a note and finish with the line ' + CONTINUE_MARK + ' <title of the next subtopic>. I will reply "continue".',
    '',
    'NOTE TEMPLATE (use for every note):',
    NOTE_TEMPLATE,
    '',
    'RULES FOR ACCURACY',
    '- Well-established nursing knowledge only. If unsure, write "verify" in "Check against your textbook" instead of guessing.',
    '- Never invent drug doses, lab ranges, statistics, guidelines, citations, page numbers or links. Give a number only if standard textbook knowledge and you are confident.',
    '- Do not copy or recall real board-exam questions; describe how the exam asks, in your own words.',
    '- Where Philippine practice or policy (DOH programs, local protocols) may differ from general textbooks, mark it "verify local policy".',
    '- This is study support, not advice for a real patient.',
    '',
    'OUTPUT FORMAT (my app reads this, so follow it exactly)',
    '- Coverage map first, plain text, NO line that starts with "# ".',
    '- Then each note starts with exactly ONE "# " heading line (single # then a space and the title). Use "##" inside notes. No other single "#" anywhere.',
    '- Link related notes with [[Exact Note Title]], including other exam areas.',
    '- When the last note is done and the map is complete, end with the line ' + END_MARK + '.',
    '- No introduction, no closing chat, no code fences around the notes.',
  );

  return lines.join('\n');
}

export interface TopicBuilderResult {
  /** Text before the first note (the coverage map), kept for display. */
  coverageMap: string;
  topics: Topic[];
  /** Set when the model stopped early and named the next subtopic. */
  continueFrom?: string;
  /** True when the reply ended with the END mark. */
  complete: boolean;
}

/** Parses a pasted reply. Never throws; unusable input returns zero topics. */
export function parseTopicBuilderReply(
  raw: string,
  folderId: string,
  existing: Topic[],
  idPrefix: string,
): TopicBuilderResult {
  let text = raw.replace(/\r\n/g, '\n').replace(/^```[a-z]*\n?|\n?```$/gim, '');
  let continueFrom: string | undefined;
  const cont = new RegExp(`^\\s*${CONTINUE_MARK}\\s*(.+)$`, 'im').exec(text);
  if (cont) {
    continueFrom = cont[1].replace(/[<>*_`]/g, '').trim() || undefined;
    text = text.replace(new RegExp(`^\\s*${CONTINUE_MARK}.*$`, 'gim'), '');
  }
  const complete = new RegExp(`^\\s*${END_MARK}\\s*$`, 'im').test(text);
  text = text.replace(new RegExp(`^\\s*${END_MARK}\\s*$`, 'gim'), '');
  const firstNote = text.search(/^#\s+\S/m);
  const coverageMap = firstNote > 0 ? text.slice(0, firstNote).trim() : firstNote === 0 ? '' : text.trim();
  const topics = firstNote >= 0 ? parseFixTopics(text.slice(firstNote), folderId, existing, idPrefix) : [];
  return { coverageMap, topics, continueFrom, complete };
}
