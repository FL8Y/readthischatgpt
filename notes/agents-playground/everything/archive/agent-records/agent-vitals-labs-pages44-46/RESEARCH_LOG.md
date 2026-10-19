# Research Log — textbook pages 44–46

Date: 2026-10-18

## Repository standards reviewed
Read the live repository files: `NOTES_MAKER_SOURCE_OF_TRUTH.md`, `START_HERE_NOTES.md`, `notes/SESSION_PROTOCOL.md`, `notes/PROJECT_STATUS.md`, `notes/WORK_QUEUE.md`, `notes/MASTER_SYSTEM_PROMPT.txt`, `notes/RESEARCH_AND_DESIGN.md`, `notes/RESEARCH_LOG.md`, `notes/COMPLETION_CHECKLIST.md`, `notes/PAGE_TRACKER_TEMPLATE.md`, `notes/generated/README.md`, `notes/agents-playground/README.md`, `notes/SESSION_HANDOFF.md`, `notes/README.md`, and `notes/USER_PROMPT_TEMPLATE.txt`. These set requirements for image coverage, source/explanation separation, uncertainty marking, retrieval practice, and verified repository writes.

## Image inventory
- Upload 1, printed page 44: Vital Signs (adult vs newborn first period of reactivity) and Arterial Blood Gas (ABG) table.
- Upload 2, printed page 45: Immunoglobulin Electrophoresis and Coagulation Studies.
- Upload 3, printed page 46: Hematologic Studies, including CBC measures and differential WBC percentages.

## External references consulted
1. MedlinePlus Medical Encyclopedia, “Vital signs” — common resting adult values and note that ranges vary with age and health. https://medlineplus.gov/ency/article/002341.htm
2. MedlinePlus Medical Test, “Arterial Blood Gas (ABG) Test” — common arterial pH, PaCO2, bicarbonate, PaO2, and saturation ranges. https://medlineplus.gov/lab-tests/arterial-blood-gas-abg-test/
3. Merck Manual Professional Edition, “Acid-Base Disorders” — pH, respiratory/metabolic components, and compensation/mixed-disorder cautions. https://www.merckmanuals.com/professional/nephrology/acid-base-regulation-and-disorders/acid-base-disorders
4. MedlinePlus Medical Encyclopedia, “CBC blood test” — CBC components and common ranges with laboratory variation caveat. https://medlineplus.gov/ency/article/003642.htm
5. MedlinePlus Medical Encyclopedia, “Partial thromboplastin time (PTT)” — PTT purpose, heparin monitoring, general range, and variability. https://medlineplus.gov/ency/article/003653.htm
6. MedlinePlus Medical Test, “Prothrombin Time Test and INR (PT/INR)” — warfarin monitoring and INR interpretation. https://medlineplus.gov/lab-tests/prothrombin-time-test-and-inr-ptinr/
7. NCBI Bookshelf, “The distribution and functions of immunoglobulin isotypes” — antibody distribution and functional distinctions. https://www.ncbi.nlm.nih.gov/books/NBK27162/

## Source concerns recorded rather than silently corrected
- p. 44: source shows newborn temperature 100.6°F/38.1°C in vital-sign table; this should not be treated as an ordinary normal target without age-specific current guidance.
- p. 44: source appears to show adult pulse pressure “100 mmHg (during exercise)”; this is questionable as a standard normal reference value. Formula is explained separately.
- p. 45: PTT and aPTT rows show differing normal ranges and a therapeutic range that appears misaligned. Notes preserve the printed table and separately state common test/medication associations.
- p. 44: source labels PaO2 as an indirect measure of oxygen content; notes qualify the distinction between partial pressure and total oxygen content.
- p. 46: possible causes are presented as source associations, not diagnostic rules. Reference ranges vary by lab and population.

## Verification result
- Saved deliverable: `DELIVERABLES/nursing-vital-signs-abg-immunoglobulins-coagulation-cbc-pp44-46.md`
- Re-fetched from GitHub after write; returned blob SHA: `5b61a85207bd60eb69c62d4c18579f9228b9b9fb`.
- Saved file length: 22,318 characters.
- Programmatic audit: 27/27 expected markers passed, including vital signs, ABG values, all immunoglobulin classes, PT/PTT/aPTT/INR, RBC/Hct/Hgb/platelets/WBC, all five differential types, cautions, retrieval questions, and external references.
- The checklist and work queue were updated only after this check.

**Limit:** This verifies source coverage markers and saved-file persistence, not a qualified clinician's review of every medical statement. The source's questionable values remain clearly labeled.
