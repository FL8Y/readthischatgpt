# Research and Build Log

## Objective
Build a source-faithful image-to-notes prompt for sequential textbook pages, especially nursing study material, and a cross-session workflow that prevents repeating completed work.

## Evidence-informed decisions
- Faithful page coverage and explicit uncertainty come before summary or embellishment.
- Match note representation to content: outlines, comparison tables, causal chains, concept maps, timelines, and stepwise checklists.
- Nursing disease notes may connect causes/risk, normal function, pathophysiology, manifestations, diagnostics, complications, management, nursing assessment/interventions, rationale, monitoring, and education when the source supports them.
- Keep prioritization contextual; frameworks are lenses, not universal rules.
- Include retrieval questions and concise answer rationales by default, while respecting notes-only requests.
- Add project status, work queue, and session handoff to make state portable across chats.
- Never mark tasks complete without a fresh verification signal.

## Research synthesis
See RESEARCH_AND_DESIGN.md for the focused evidence review and source links.

## Current limits
- Focused web review, not a formal systematic database search.
- No representative image set has been processed as a formal acceptance test.
- No qualified nursing reviewer has audited generated notes.
- Prompt improvements do not prove image-extraction accuracy or clinical currency.

## Change log
- Initial version: source-faithful notes framework.
- Improvement pass: nursing-specific logic, topic-matched note formats, priority caveats, learning-science retrieval features, evidence summary, and cross-session anti-loop state files.
- Update this log only after the corresponding repository writes have been verified.