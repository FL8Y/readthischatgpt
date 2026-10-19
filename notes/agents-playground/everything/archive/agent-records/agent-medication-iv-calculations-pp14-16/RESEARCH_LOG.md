# Research Log — Medication / IV Calculations, pp. 14–16

## Repository digestion completed
Read live repository contents on the current `main` branch:
- `NOTES_MAKER_SOURCE_OF_TRUTH.md`
- `START_HERE_NOTES.md`
- `notes/SESSION_PROTOCOL.md`
- `notes/PROJECT_STATUS.md`
- `notes/WORK_QUEUE.md`
- `notes/MASTER_SYSTEM_PROMPT.txt`
- `notes/RESEARCH_AND_DESIGN.md`
- `notes/RESEARCH_LOG.md`
- `notes/COMPLETION_CHECKLIST.md`
- `notes/PAGE_TRACKER_TEMPLATE.md`
- `notes/generated/README.md`
- `notes/agents-playground/README.md`
- `notes/agents-playground/AGENT_MASTER_PROMPT.md`
- `Nursing app master plan/nursing preset topics/Anki Deck Topic Hierarchy/README.md`
- `Nursing app master plan/nursing preset topics/Anki Deck Topic Hierarchy/02 Fundamentals/RESEARCH TOPIC GUIDE.md`
- `notes/SESSION_HANDOFF.md` and `notes/README.md`

Repository rules applied: source-faithful image extraction; explicit uncertainty; topic-adaptive notes; clinical safety details; external updates separated from source content; actual files in an assigned playground; re-fetch and compare before marking complete. The project-level work queue still reports image-to-repository validation tests pending. This sample is relevant to its clear-prose, dense-table, and medication-calculation cases, but does not validate every project acceptance test.

## Image inventory
- Upload 1, printed p. 14: drug dose formula and three IV calculations.
- Upload 2, printed p. 15: pediatric dose formulas and written orders.
- Upload 3, printed p. 16: selected IV solutions.
- Exact coverage is recorded in `IMAGE_COVERAGE_CHECKLIST.md`.

## External sources inspected
1. **NCBI Bookshelf / StatPearls — “Pharmacy Calculations.”** https://www.ncbi.nlm.nih.gov/books/NBK560924/  
   Supports standard drop-rate calculation, the importance of units and the normal-saline concentration. Used to cross-check formula structure; the worked arithmetic was independently calculated from the visible image.
2. **American Physiological Society, Advances in Physiology Education — “Isosmotic is not always isotonic: the five-minute version.”** https://journals.physiology.org/doi/full/10.1152/advan.00080.2016  
   Explains that D5W may be isosmotic in the container yet has a physiologically hypotonic effect after glucose enters cells and is metabolized. Used to flag the distinction without silently altering the textbook table.
3. **U.S. FDA — “Labeling Changes on mortality, kidney injury, and excess bleeding with hydroxyethyl starch products” (July 7, 2021).** https://www.fda.gov/vaccines-blood-biologics/safety-availability-biologics/labeling-changes-mortality-kidney-injury-and-excess-bleeding-hydroxyethyl-starch-products  
   Official safety communication for hydroxyethyl starch (HES) products, including Hespan: mortality, kidney injury, excess bleeding; FDA says do not use unless adequate alternative treatment is unavailable.
4. **U.S. FDA — HESPAN package insert.** https://www.fda.gov/media/87260/download  
   Cross-checks the product-specific boxed warning and restricted-use statement. Product label/jurisdiction differences should be checked for local practice.

## Findings and editorial decisions
- All four calculation methods/examples on p. 14 are legible. For infusion duration, units were written explicitly as volume × drop factor ÷ gtt/min to show why the answer is in minutes.
- “PLR” is retained as printed; the source page does not define the abbreviation.
- Macrodrip factors were preserved as the page prints them (10, 15, 25 gtt/mL), rather than normalizing to common alternate lists.
- Pediatric rules are presented as source content but labeled legacy estimation formulas; no actual pediatric dose recommendation is made.
- The source places D5W in the isotonic row. The notes preserve that source claim and separately explain its physiologic hypotonic effect after glucose metabolism.
- Hespan is retained in the source's volume-expander list, but the FDA warning is added separately to prevent the old list from implying routine equivalence or preferred use.
- The textbook's broad caution around hypertonic solutions and heart/kidney disease/dehydration is preserved as a source statement and qualified separately; it is not rewritten into a universal prescribing rule.

## Verification record
- Initial repository reads: completed.
- Image inspection and coverage mapping: completed for three uploaded pages.
- External evidence: sources listed above were opened from web search results and checked for the claims used.
- Repository write/re-fetch audit: pending until the saved Markdown files are fetched back from the live repository.
- Clinical expert review: not performed; do not claim expert review.
