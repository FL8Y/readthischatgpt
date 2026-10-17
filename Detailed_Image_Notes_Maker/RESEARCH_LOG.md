# Research and Build Log

## Objective
Create a reusable framework for detailed notes from sequential book-page images, separate from the PNLE Question Prompt Maker.

## Design decisions
- Treat user-supplied images as the primary source.
- Capture all meaningful visible content, including visual elements and small-print details.
- Preserve page order and printed page numbers where legible.
- Mark unreadable or cropped material explicitly instead of guessing.
- Distinguish source-derived notes from added clarifications.
- Transform content into organized notes rather than copying long passages.
- Track pages, terms, continuity, and unresolved gaps.
- Make practice questions optional and configurable.

## Evidence and limitations
- The prompt framework is a designed specification, not proof of accurate image extraction.
- No representative book-page images have yet been processed as a formal test set.
- Dense tables, multi-column layouts, diagrams, glare, blur, handwriting, and cropped text require practical validation.
- Subject-matter accuracy should be checked against the supplied source, especially for technical or high-stakes material.
- The framework does not claim that unseen pages were read or that all content will be captured perfectly.

## Validation plan
- [ ] Test a clear prose page and compare coverage against every visible heading.
- [ ] Test a dense table and verify row/column relationships.
- [ ] Test a diagram or flowchart and verify labels, arrows, and sequence.
- [ ] Test a deliberately blurry/cropped region and confirm uncertainty is marked.
- [ ] Test two adjacent pages for continuity and duplicate handling.
- [ ] Test final consolidation against the tracker and identify gaps.
- [ ] Review output for unnecessary verbatim reproduction.

## Current status
- [x] Master system prompt drafted.
- [x] User prompt template drafted.
- [x] README drafted.
- [x] Page tracker drafted.
- [x] Completion checklist drafted.
- [ ] Image-based functional tests completed.
- [ ] Independent subject-matter review completed.
- [ ] Production readiness established.

## Change log
- Initial setup: created the framework and documented untested criteria. Functional claims remain pending until tested with real page images.