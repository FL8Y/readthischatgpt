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
  '2-4 plain sentences.',
  '## Must-know facts',
  '- bullets of facts a nurse must remember',
  '## What the nurse assesses',
  '- findings, signs, risk factors (expected vs abnormal)',
  '## Priority nursing actions',
  '1. numbered in priority order, and say WHY that order (Maslow / ABC / safety / assess before act)',
  '## Treatments and medications (general terms only)',
  '- drug classes and what to watch; NO doses unless you are certain they are standard',
  '## Complications and red flags',
  '- what needs immediate action or reporting',
  '## Client and family teaching',
  '- teach-back points; what shows understanding',
  '## How the exam asks about it',
  '- typical question patterns, "which first" traps, look-alike options',
  '## Memory aid',
  '- a mnemonic only if it is genuinely useful; say if you made it up',
  '## Related topics',
  '- [[Another subtopic]], [[A topic in another area]] (use exact note titles so links connect)',
  '## Check against your textbook',
  '- anything you are less than sure of, anything beyond common textbook teaching, and anything that may differ in Philippine practice or policy',
].join('\n');

/** The full prompt text. Pure: same input, same output. */
export function topicBuilderPrompt(input: TopicBuilderInput): string {
  const topic = input.topic.trim() || '[WRITE YOUR TOPIC HERE]';
  const words = Math.min(900, Math.max(250, Math.round(input.wordsPerNote ?? 500)));
  const existing = (input.existingTitles ?? []).filter((t) => t.trim());
  const lines: string[] = [];

  lines.push(
    'ROLE',
    'You are a Philippine nursing licensure exam (PNLE) review writer and tutor. You write complete, clear, accurate study notes for one nursing student. You think like a board-exam item writer: you know what is tested, how it is tested, and where students lose points.',
    '',
    'MY TOPIC',
    topic,
    input.area?.trim() ? `Exam area: ${input.area.trim()}` : 'Exam area: choose the best fit from the list below and say which.',
    '',
    'EXAM AREAS (current structure as best known; if you disagree, say so):',
    PNLE_AREAS_TEXT,
    '',
  );

  if (input.notes?.trim()) {
    lines.push(
      'MY OWN NOTES (build on these; keep what is right, fix what is wrong, and tell me what you changed under "Check against your textbook"):',
      '"""',
      input.notes.trim().slice(0, 6000),
      '"""',
      '',
    );
  }
  if (existing.length) {
    lines.push(
      'NOTES I ALREADY HAVE (do not rewrite these titles; link to them with [[Title]] where related):',
      existing.slice(0, 80).map((t) => `- ${t}`).join('\n'),
      '',
    );
  }
  const outline = input.referenceOutline ?? relatedOutline(topic, input.area);
  if (outline.length) {
    lines.push(
      'REFERENCE COVERAGE LIST (headings from my own review deck; cover every one that belongs under my topic, merge tiny ones, and tell me in the coverage map if one is not exam-relevant):',
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
    'Cover my topic COMPLETELY so I do not miss anything the exam could ask. Work in this order:',
    '1. COVERAGE MAP. Before any notes, write a numbered checklist of EVERY subtopic, concept, skill, drug class, program, law and common exam trap that belongs under my topic across all five exam areas. Be exhaustive: include basics, assessment, priority actions, complications, teaching, ethics/legal, community and Philippine health-program angles where relevant, and cross-links to other topics. Mark each item high / medium / low exam priority. Think about what is easy to forget, and add it.',
    '2. NOTES. Then write one note for each checklist item, in the exact template below. Order them from most to least important. Notes for tiny items may be short; important ones should be thorough. Aim for about ' + words + ' words per important note.',
    '3. SELF-AUDIT. Silently re-read your coverage map and confirm every item has a note. If you ran out of room, stop at a clean boundary (end of a note) and finish with the line ' + CONTINUE_MARK + ' <title of the next subtopic>. I will reply "continue".',
    '',
    'NOTE TEMPLATE (copy this structure for every note):',
    NOTE_TEMPLATE,
    '',
    'OUTPUT FORMAT (my app reads this, so follow it exactly)',
    '- Write the coverage map first as plain text with NO line that starts with "# ".',
    '- Then each note starts with exactly ONE "# " heading line (a single # followed by a space and the title). Use "##" for the sections inside a note. Never use a single "#" anywhere else.',
    '- Use [[Exact Note Title]] links to connect related notes, including notes for other exam areas.',
    '- When the last note is finished and the coverage map is complete, end with the line ' + END_MARK + '.',
    '- No introduction, no closing chat, no code fences around the notes.',
    '',
    'RULES FOR ACCURACY',
    '- Use only well-established nursing knowledge. If you are not sure, say "verify" in the "Check against your textbook" section instead of guessing.',
    '- Never invent drug doses, lab ranges, statistics, guidelines, citations, page numbers or links. Give a number only if it is standard textbook knowledge and you are confident.',
    '- Do not copy or recall real board-exam questions. Describe how the exam asks, in your own words.',
    '- Say where Philippine practice or policy (DOH programs, local protocols) may differ from general textbooks, and mark it "verify local policy".',
    '- Teach for understanding: explain WHY, put actions in priority order, and show how Maslow, ABCs, safety and assess-before-act decide the order.',
    '- This is study support for an exam, not advice for a real patient.',
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
