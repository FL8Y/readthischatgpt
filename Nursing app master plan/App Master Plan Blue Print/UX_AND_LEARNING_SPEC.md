# UX and Learning Specification — Nursing Study App

**Status:** Initial requirements and design constraints. No UI implementation authorized.

## 1. Product principle

The interface should answer three questions quickly:
1. What should I study next?
2. Why is the app recommending it?
3. How will I know whether I have learned it?

The dashboard should not become a wall of charts. Prioritize the next recommended action, due reviews, current module progress, and a concise view of weak topics.

## 2. Primary navigation proposal

Navigation should be validated after platform choice, but the conceptual destinations are:
- **Home:** recommended next action, due reviews, active learning plan, progress summary.
- **Library:** subjects, modules, topics, imported sources, search and linked concepts.
- **Study:** diagnostic, lesson, topic quiz, module assessment and remediation.
- **Review:** due flashcards, review queue, session summary.
- **Tutor:** source-aware discussion with current topic context.
- **Progress:** topic mastery, confidence/evidence, assessment history, points and streaks.
- **Settings:** provider setup, privacy, backup/export, accessibility, notifications and data controls.

Avoid making the user navigate through many nested screens to answer one question or review one card.

## 3. Required journeys

### A. First launch and API configuration
1. Explain why an AI provider is needed and which features require it.
2. Allow configuration now or a clear limited/offline mode. Limited/offline mode may support import, saved lessons, and due-card review, but it must not bypass the diagnostic gate for teaching a new selected scope.
3. Never display a saved secret in plaintext after saving.
4. Test/validate the connection with a minimal request and a safe error.
5. Explain invalid key, unsupported model, quota/rate limit, no network, and provider outage separately.
6. Provide change/remove key and data-retention information.
7. Do not imply local encryption makes a key impossible to extract.

### B. Import study material
1. Select supported input type.
2. Validate file type/size and show progress.
3. Extract and preview content with source locations.
4. Let the learner correct title, subject, and module mapping.
5. Show what will be saved and sent to the AI provider.
6. Preserve original source and import status.
7. Recover from corrupt, empty, scanned-only, unsupported, or oversized files without losing other work.

### C. Start a new subject/module
1. Show what sources and topics are included.
2. Require completion of a 1–50 question diagnostic before teaching any new topic in this selected scope; no silent skip or bypass in the normal learning flow.
3. Let the learner choose a count from 1–50 or use a documented default.
4. Save progress if the session is interrupted and resume the same diagnostic safely.
5. Present topic-level results with evidence count and confidence.
6. Explain the recommended learning order rather than showing only a score. A separate review-only mode may revisit already-taught material but cannot be used to open new lessons without a diagnostic.

### D. Study a topic
1. Display the learning objective and estimated time.
2. Present a structured explanation, source references, visual aid where available, mnemonic if useful, and links to related topics.
3. Avoid dumping a single unstructured AI essay.
4. Let the learner ask for simpler wording, a worked example, or a deeper explanation.
5. Mark lesson completion separately from demonstrated mastery.
6. Offer a 1–5 question topic quiz with instant feedback and a clear explanation.

### E. Complete a module assessment
1. Explain scope and estimated time.
2. Preserve progress through interruptions.
3. Show results by topic and objective.
4. Distinguish wrong answers from unanswered/flagged items.
5. Generate a prioritized remediation plan with reasons.
6. Reassess after remediation using new or appropriately varied questions.

### F. Review flashcards
1. Open directly into due reviews.
2. Keep card content readable and interactions predictable.
3. Capture Again/Hard/Good/Easy or equivalent rating.
4. Explain the next due date when useful.
5. Persist the rating before showing a final success state.
6. Handle offline use and app interruption.
7. Avoid gamification that pressures a learner to rush or answer without retrieval.

### G. Tutor discussion
1. Make current topic/source context visible.
2. Support follow-up questions and alternate explanations.
3. Distinguish source-grounded answer from general model knowledge.
4. Show relevant source locations when available.
5. If sources conflict or do not answer the question, say so and offer a safe next step.
6. Avoid treating the app as patient-specific clinical decision support.

## 4. Screen states and accessibility

Every networked screen needs loading, success, empty, error, retry, and offline states where applicable. Every long task needs progress, cancellation where safe, and recoverability.

Accessibility requirements:
- never encode correctness or topic state through color alone;
- readable body text and adjustable text scaling;
- semantic labels for interactive controls and charts;
- logical focus order and screen-reader announcements for feedback;
- adequate touch targets and spacing;
- contrast that remains usable in light/dark themes if both are supported;
- text/list alternative for graph visualizations;
- avoid flashing, time pressure, or motion as the only signal;
- preserve quiz state when app is backgrounded or recreated.

## 5. Learning effectiveness model

### Diagnostic assessment
A diagnostic is a mandatory gate before first teaching in the selected scope, not an optional recommendation. It is an estimate of prior knowledge, not a verdict. It must contain 1–50 questions, sample the scope according to a blueprint, avoid repeated near-identical questions, preserve interruption/resume state, and provide topic-level evidence. Guessing and small sample size reduce confidence. A missing API key may block AI generation, but it does not silently waive the gate.

### Lessons
Teach gaps in an order that respects prerequisites and learning objectives. Explain why each topic is selected. A lesson should include a concise core explanation, deeper detail, examples, key distinctions, and source references as appropriate. Mnemonics are aids, not substitutes for correct understanding.

### Retrieval and feedback
Feedback should identify the correct answer, explain the underlying reasoning, and address common misconceptions. For clinical topics, the rationale must not overstate certainty or invent a source. Incorrect answers should inform future review without labelling the learner.

### Spaced repetition
Review scheduling should use actual recall ratings and review history. Weak cards should appear sooner according to a documented scheduler policy. Avoid using the number of taps or total screen time as a proxy for mastery.

### Mastery and confidence
Display a mastery estimate alongside evidence/confidence. A learner with two correct responses should not receive the same certainty as a learner who has demonstrated correct retrieval over time across varied questions. Use labels such as “new,” “developing,” “likely mastered,” and “insufficient evidence” only after definitions are documented.

### Module readiness
Readiness should reflect coverage, recent performance, and evidence sufficiency. It is not a clinical competence certification. Provide transparent reasons for recommendations.

## 6. Gamification policy

Points should reward meaningful events: valid answer attempts, completed learning activities, and review consistency. All reward events must be idempotent. Prevent farming by repeating the same completed activity or submitting the same event twice.

Streaks should account for time zones and provide a clear policy for travel/time changes. Do not make the user lose learning history because a streak ends. Levels/ranks should be motivating and should never conceal weak topic areas.

## 7. Nursing content safeguards

- Preserve source names, versions, pages/sections, and import dates when available.
- Clearly distinguish source quotation, source-derived summary, and AI-added explanation.
- Do not fabricate citations.
- Flag conflicting or insufficient source content.
- Use authoritative, current references for high-risk clinical claims when external research is part of the workflow.
- Keep educational explanations distinct from patient-specific diagnosis/treatment advice.
- Include relevant context/qualifiers in clinical rationales.
- Allow users to report a suspected error and correct/retire unsafe generated content.
- Version generated content so past answers remain interpretable.
- Never treat a high quiz score as proof that a learner can safely perform a clinical procedure.

## 8. UX acceptance tests

- A learner cannot open new topic lessons in a scope until its 1–50 question diagnostic is completed.
- A learner can resume an interrupted diagnostic, lesson, assessment, and review session.
- Every recommended topic explains why it was selected.
- Quiz feedback is understandable without relying on color.
- Source references open to the relevant material.
- A topic with insufficient evidence is not shown as definitively mastered.
- Offline review ratings are not lost.
- Invalid provider credentials produce actionable feedback and do not crash the app.
- A graph has a navigable text alternative.
- Dynamic text and screen readers can access quiz prompts, options, correctness, and rationales.
- Duplicate submissions do not duplicate points or streak updates.
