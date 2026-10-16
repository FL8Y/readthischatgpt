# PNLE research for the PNLE Question Studio (T1)

Date of research: 2026-10-16. Method: web search and page fetch only. Public sources only.

Labels: OBSERVED = seen on a cited page (or in a search-result summary of that page, flagged "via search"); INFERRED = my deduction; UNKNOWN = not found.

## Safety and method notes

- OBSERVED: Every PRC PDF/page I tried (`2025-10 ... Enhanced TOS nuse.pdf`, `2025-16 annex A nurse.pdf`, the 2026 exam-program PDF, `prc.gov.ph/Pages/PRBv4/Nursing.htm`) failed to fetch: WebFetch returned HTTP 503 and `curl` through the proxy returned "Connection reset by peer" (so `pdftotext` could not be used). Scribd copies would not load either.
- Consequence: I did NOT read the official TOS text myself. Everything about the TOS below comes from search-engine summaries of the PRC pages and from third-party review sites. Item-level figures are lower confidence than they look. A human (or a later session with working PRC access) should open the two PRC PDFs and confirm the table in "TOS by area".
- I did not open or use any page that publishes leaked or recalled board-exam questions. None of the pages used here contain exam items.
- Web pages were treated as untrusted data. No question content was reproduced or recalled.

## Findings

1. OBSERVED (via search of PRC pages): the current TOS is the "Enhanced Table of Specifications" adopted by Board of Nursing Resolution No. 10, series of 2025, with the table as Annex A (PQF Level 6, Bloom-style cognitive levels). It applies from the November 2025 licensure exam onward and supersedes Resolution No. 18 s. 2006 and Resolution No. 11 s. 2017.
2. **What NP I really is: OBSERVED, resolved.** NP I is NOT "Foundation of Professional Nursing Practice". NP I = "Care of Individuals, Families, Population Groups and Community" (Community Health Nursing). Evidence: PRC 2026 exam-program titles (as relayed by search), nursepass.io, brainedapp, supertutor, nurseslabs. The earlier project assumption (NP1 = Foundation of Professional Nursing Practice) is wrong for the licensure exam. Fundamentals, ethics, pharmacology, leadership and research run through all five tests rather than forming a separate test (supertutor, OBSERVED).
3. NP II = Care of Mother and Adolescent (well clients, at risk or with problems, acute and chronic) plus Human Growth and Development (neonate through adolescent). OBSERVED (PRC exam program via search; brainedapp).
4. NP III = surgery, oxygenation, fluid and electrolytes, infectious/inflammatory/immunologic response, cellular aberrations. NP IV = nutrition and GI, metabolism and endocrine, perception and coordination. NP V = maladaptive patterns of behavior (psychiatric) plus life-threatening / acutely ill / emergency. OBSERVED (nursepass, brainedapp, supertutor agree).
5. Weights: each NP is one of five 100-item tests, so each is 20% of the 500 items. OBSERVED that sources say 100 items per subject / 500 total and 20% each (nurseslabs, supertutor, brainedapp). I did not see a PRC-sourced percentage per NP; the 20% is INFERRED from 100 of 500 (and stated by nurseslabs).
6. Passing rule: general average at least 75% and no rating below 60% in any of the five tests (RA 9173 Sec. 15). OBSERVED on several sites; Wikipedia quotes the statute wording. A candidate with a 75% average but under 60% in some test retakes only those tests (nurseslabs, supertutor).
7. The project CLAUDE.md queue item says "NP2 Community Health + Mother and Child, NP3-NP5 Care of clients with physiologic/psychosocial alterations". That is also wrong for the current TOS. Community Health is NP I alone; NP II is maternal/adolescent plus growth and development.
8. Exam sittings changed: 2021 had July and November; 2022 to 2025 had May and November; the 2026 PRC calendar uses February and August (Res. No. 2113 s. 2025 per brainedapp). The "May/November" assumption holds only through Nov 2025.
9. National passing rates swung widely: 51.45% (Nov 2021) to 90.04% (Nov 2025). Nov 2025 is the first sitting under the Enhanced TOS.

## TOS by area (table)

Source confidence: PRC document NOT read directly (see top). "via search" = a search-engine summary of the PRC PDF.

| Test | Official-style title (as relayed) | Weight | Items | Main content areas | Evidence |
|---|---|---|---|---|---|
| NP I | Care of Individuals, Families, Population Groups and Community (Community Health Nursing) | 20% of exam (INFERRED from 100/500) | 100: Part A 80 + Part B 20 | Part A: care of clients with non-communicable and communicable diseases; normal families, families at risk, population groups with other health priorities. Part B: health education and research utilization | PRC exam program + PRC annex via search; brainedapp; nursepass. An unverified Studocu copy lists Part A sub-counts 10 / 10 / 20 and Part B health education 10 / research 10; not verified |
| NP II | Part 1: Care of Mother and Adolescent (well clients, at risk or with problems, acute and chronic); Part 2: Human Growth and Development (neonate through adolescent) | 20% (INFERRED) | 100; brainedapp says two parts of 50 | Maternal care antepartum/intrapartum/postpartum, reproductive health, pregnancy complications; growth and development, child and adolescent care | PRC exam program via search; brainedapp; supertutor; nursepass |
| NP III | Care of clients with problems in Surgery, Oxygenation, Fluid and Electrolytes, Infectious, Inflammatory and Immunologic Response, Cellular Aberrations | 20% (INFERRED) | 100 (Part A 80% / Part B 20% per brainedapp; not verified at PRC) | Perioperative care, respiratory/gas exchange, fluid-electrolyte and acid-base, infection and immune disorders, cellular aberrations | nursepass; brainedapp; supertutor |
| NP IV | Care of clients with problems in Nutrition and Gastro-Intestinal, Metabolism and Endocrine, Perception and Coordination | 20% (INFERRED) | 100 (Part A 80% / Part B 20% per brainedapp; not verified) | Nutrition, GI, diabetes/endocrine, neurologic, musculoskeletal, vision/hearing (nursepass lists these) | nursepass; brainedapp; supertutor |
| NP V | Care of clients with Maladaptive Patterns of Behavior; Life-Threatening Conditions, Acutely Ill / Multi-Organ Problems, High Acuity and Emergency Situations | 20% (INFERRED) | 100 (part split UNKNOWN) | Psychiatric and mental health nursing; critical care, shock and multi-organ failure, emergency care | nursepass; brainedapp; supertutor |

Cross-cutting (OBSERVED, nurseslabs/supertutor): underlying disciplines (anatomy and physiology, nutrition and diet therapy, pathophysiology, microbiology/parasitology, pharmacology) and the Competency Standards of Nursing Practice in the Philippines (11 Key Areas of Responsibility) run through all tests. OBSERVED (via search): the annex is organized by Bloom-style levels from remembering to creating; one secondary summary says about half the items sit at "applying", UNVERIFIED.

### Source conflicts on names (important for tags)

- nurseslabs.com and reviewersph.com label NP III, IV, V as "Care of Clients with Physiologic and Psychosocial Alterations Part A / B / C" and describe NP II as healthy/at-risk mother and child. That is an older style. Their content lists look generic and differ from the PRC-titled sources (for example, they put psychiatry, leadership and delegation in NP V). I rate them lower.
- brainedapp calls NP III "Medical Surgical Nursing (Part A)" and NP IV "(Part B)"; those are its own labels.
- supertutor and nursepass match the PRC-style titles above.
- Recommended app tags (INFERRED, pending a direct read of the PRC annex): NP1 Community Health; NP2 Maternal and Adolescent plus Growth and Development; NP3 Surgery/Oxygenation/Fluids-Electrolytes/Infection-Immune/Cellular; NP4 Nutrition-GI/Metabolism-Endocrine/Perception-Coordination; NP5 Psychiatric plus Emergency/Critical.

### Which TOS applies to which exam

| Exam | TOS in force | Note |
|---|---|---|
| Jul 2021, Nov 2021, May 2022, Nov 2022, May 2023, Nov 2023, May 2024, Nov 2024, May 2025 | Res. No. 11 s. 2017 (which "reclassified" NP I and II relative to Res. No. 18 s. 2006) | INFERRED: the 2025 resolution says it replaces the 2006 and 2017 versions from Nov 2025, so the 2017 version applied before; I did not see an explicit statement per sitting |
| Nov 2025, Feb 2026, Aug 2026 | Enhanced TOS, Res. No. 10 s. 2025, Annex A | OBSERVED via search: applies "to the November 2025 NLE and later" |
| 2006 and 2017 version content | UNKNOWN | Text not retrieved. What NP I was named in 2006 or 2017 is not confirmed |

## Exam record by year (table)

All figures come from news/aggregator pages relaying PRC releases; PRC pages themselves were not fetched.

| Sitting | Exam dates | Examinees | Passers | National rate | Notes and sources |
|---|---|---|---|---|---|
| Jul 2021 (rescheduled) | 3-4 Jul 2021 | 7,746 | 5,008 | 64.65% | thesummitexpress.com July 2021 page. Originally set for May 2021, moved earlier for pandemic workforce needs |
| Nov 2021 | 21-22 Nov 2021 | 11,828 | 6,086 | 51.45% | Released 10 Dec 2021; prc.gov.ph/manila node 5370 title "twelve (12) working days" |
| May 2022 | 29-30 May 2022 | 9,729 | 6,616 | 68.00% (68.01% in one school report) | Released 10 Jun 2022 per search relay |
| Nov 2022 | 12-13 Nov 2022 | 24,903 | 18,529 | 74.40% | Released 29 Nov 2022; Summit Express, SLU, TSU relays |
| May 2023 | UNKNOWN | 14,364 | 10,764 | 74.94% | Malaya and Inquirer (June 2023) relays |
| Nov 2023 | UNKNOWN (results about 1-2 Dec 2023) | 32,203 | 25,761 | about 80% | Manila Times 3 Dec 2023 via search |
| May 2024 | 6-7 May 2024 | 11,116 | 7,749 | 69.71-69.72% | Inquirer, Daily Tribune |
| Nov 2024 | UNKNOWN | 34,534 | 29,349 | 84.99% | prcboard.com via search |
| May 2025 | 5-6 May 2025 | 10,770 | 6,935 | 64.39% | Released 14 May 2025; 17 testing centers; Summit Express, philnews |
| Nov 2025 | UNKNOWN | 45,192 | 40,692 | 90.04% | DZRH, Tribune; first Enhanced TOS sitting. Topnotcher rating conflicts: 93.80% vs 88.50% |
| Feb 2026 | 26-27 Feb 2026 | 8,162 | 3,611 | 44.24% | Rappler via search; results about 6 Mar 2026; 21 testing centers |
| Aug-Sep 2026 | UNKNOWN (brainedapp: 29-30 Aug) | 37,359 | 28,652 | 76.69% | astig.ph, philnews, Manila Times via search; released 18 Sep 2026; 21 results withheld |
| May 2026 | No sitting found | UNKNOWN | UNKNOWN | UNKNOWN | The 2026 calendar uses Feb and Aug |

Arithmetic check (INFERRED): all rows recompute to the stated rates within rounding (for example 5008/7746 = 64.65%, 6086/11828 = 51.45%, 40692/45192 = 90.04%, 28652/37359 = 76.69%). The Inquirer headline "up from 60% to 74%" is not explained by my rows; unresolved.

## Format facts

| Fact | Status | Source |
|---|---|---|
| 5 tests (NP I to V), 100 items each, 500 total | OBSERVED (secondary) | supertutor, brainedapp, nursepass, nurseslabs; Wikipedia says "500 multiple-choice items" |
| Multiple choice | OBSERVED | Wikipedia, nurseslabs, brainedapp |
| Exactly 4 options | UNKNOWN. Nothing authoritative found | Four options is a sensible app design, INFERRED |
| Two days; Day 1 NP I-III, Day 2 NP IV-V (supertutor) | Conflicts: nurseslabs says Day 1 NP I-II, Day 2 NP III-V | Check the PRC exam program PDF |
| About 2 hours per test | OBSERVED (brainedapp; supertutor "commonly reported"); no PRC wording seen | Medium-low confidence |
| Passing: general average at least 75% and no rating below 60% in any of five tests | OBSERVED | RA 9173 Sec. 15 as quoted by Wikipedia; nurseslabs; brainedapp; supertutor |
| Retake only the failed tests when average is 75%+ but a test is under 60% (need 75% in each, per two sites) | OBSERVED (secondary) | supertutor, nurseslabs; official wording not seen |
| Question style: clinical scenarios, critical thinking and judgment | OBSERVED (secondary) | nurseslabs, 3d-universal, supertutor |
| Results typically within about 4 to 20 working days | OBSERVED | May 2024 four working days; Nov 2024 fourteen; Nov 2021 twelve |
| Items per Bloom level | UNKNOWN | Annex not read |

## Reasoning frameworks (public guidance)

Summaries are in my own words. The pages are NCLEX-oriented educator and publisher material. INFERRED: the same logic is taught for Philippine boards, but I found no official PRC statement endorsing it.

1. **Priority wording.** Stems with "best", "priority", "initial", "first" or "most appropriate" signal that several options may be true and the task is ordering them. Source: Elsevier student blog summary of Saunders tips (OBSERVED via search). Kaplan frames priority questions as a choice among Maslow, nursing process and safety (via search; the Kaplan page returned 403 on fetch).
2. **ABC.** In life-threatening situations airway comes before breathing before circulation; a compromised airway outranks low blood pressure. Source: educator guides surfaced by search, including supertutor.ph priority-frameworks page (not opened).
3. **Maslow.** Physiologic needs outrank safety, then love/belonging, esteem, self-actualization. If a physiologic and a psychosocial option compete, physiologic usually wins; if no physiologic need is in play, look for the safety option. Source: Evolve/Elsevier and For Dummies summaries (via search).
4. **Nursing process.** Assess before intervening. If a patient is stable and the data are incomplete, gathering more information is often the best first step; if data are complete and the patient is unstable, act. Source: search summary of test-strategy pages.
5. **Safety.** When two options look equal, choose the one that protects the patient (infection control, falls, identification, avoiding harm). Source: Kaplan framing via search.
6. **Delegation.** The five rights (right task, circumstance, person, directions/communication, supervision/evaluation) come from the NCSBN/ANA National Guidelines for Nursing Delegation (2019). The nurse stays accountable and cannot delegate clinical reasoning or nursing judgment; delegation fits stable conditions, and if the condition changes the nurse reassesses. Sources: ANNA glossary, American Nurse, Nebraska Dept. of Education PDF, NCBI NBK519519 (via search; not individually opened). The exact "stable, routine tasks" list was not seen. Philippine scope-of-practice rules for delegation (RA 9173 and Board regulations) were not found; the app should flag such items "check textbook / RA 9173".
7. **Other common heuristics (INFERRED, not individually sourced):** unstable before stable, acute before chronic, least invasive first, therapeutic communication (open-ended, reflect feelings, avoid "why" and false reassurance). Treat as heuristics, not rules.
8. **Design implication (INFERRED):** the Enhanced TOS stresses application and clinical judgment, so write scenario-first items and tag each with the deciding strategy plus the NP area.

## Source list

Official or official-derived (not fully readable here):
- https://www.prc.gov.ph/sites/default/files/2025-10%20%20published%20Enhanced%20TOS%20nuse.pdf (fetch 503; search summary only)
- https://www.prc.gov.ph/sites/default/files/2025-16%20annex%20A%20nurse.pdf (fetch 503; search summary only)
- https://www.prc.gov.ph/Pages/PRBv4/Nursing.htm (fetch 503)
- https://www.prc.gov.ph/sites/default/files/exam%20progam%20feb%202026%20nle%20(nursing)%20approved.pdf and the matching aug 2026 PDF (titles via search)
- https://manila.prc.gov.ph/node/5370 (Nov 2021 release title)

Fetched and read (secondary):
- https://www.brainedapp.com/blog/pnle-2026-complete-guide
- https://nurseslabs.com/philippine-nurse-licensure-exam-pnle/
- https://www.reviewersph.com/prev/pnle-coverage
- https://supertutor.ph/resources/blog/licensure-exams/nle-2026-complete-guide/
- https://nursepass.io/pnle-np1-np5
- https://en.wikipedia.org/wiki/Philippine_Nurse_Licensure_Examination (old revision)

Seen via search summaries only:
- https://www.rappler.com/bulletin-board/examination-results/nurses-licensure-february-2026/
- https://newsinfo.inquirer.net/1940322/7749-pass-the-may-2024-nurses-licensure-exam
- https://newsinfo.inquirer.net/1791826/fwd-prc-ph-nursing-board-exam-passing-rate-increased-to-74-in-november-2022-and-may-2023
- https://manilatimes.net/2023/12/03/news/over-25k-pass-nurses-exam-prc/1922589
- https://tribune.net.ph/2024/05/14/prc-7749-pass-nursing-board-exam
- https://tribune.net.ph/2025/11/26/prc-releases-november-pnle-gle-results
- https://www.dzrh.com.ph/post/over-40000-pass-november-2025-pnle-west-visayas-state-grads-top-exam
- https://www.thesummitexpress.com/2021/07/full-results-july-2021-nle-nursing-board-exam-list-of-passers-top-10.html
- https://www.thesummitexpress.com/2025/05/pnle-results-6935-pass-may-2025-nursing-board-exam.html
- https://www.thesummitexpress.com/2022/11/p-z-passers-november-2022-nle-result.html
- https://astig.ph/prc-results-august-september-2026-nurses-licensure-exam-passers/
- https://www.prcboard.com/nle-results-november-2024-nurse-licensure-exam-list-of-passers
- https://www.slu.edu.ph/2022/12/01/saint-louis-university-is-rank-1-in-the-nursing-licensure-exam-with-100-passing-rate-grabs-ranks-24789-10-in-top-performing-examinees/
- https://www.1nurse.com/blog/story/2025/08/26/understanding-enhanced-tos-nurses-licensure-exam/ (fetch failed, 522)
- Guidance: https://www.kaptest.com/study/nclex/nclex-question-strategies-priority-questions/ (403), https://studenthub.elsevier.com/us/blog/how-to-pass-nursing-school-tests-exams/, https://evolve.elsevier.com/education/nursing-test-taking-strategies (empty on fetch), https://www.dummies.com/article/follow-maslows-hierarchy-of-needs-for-the-nclex-rn-273494, https://supertutor.ph/blog/nle-np2-medical-surgical-priority-frameworks/, https://community.annanurse.org/glossary/five-rights-of-delegation, https://www.myamericannurse.com/delegating-vs-assigning-what-you-need-to-know/, https://ncbi.nlm.nih.gov/books/NBK519519

Skipped: Scribd, Studocu and Course Hero uploads of the TOS (failed to load or user-uploaded and unverifiable). No recalled-question sites used.

## Unknowns and conflicts

1. Official TOS PDFs not read. PRC-stated weight per NP, per-topic item counts and Bloom distribution are UNKNOWN. The 80/20 Part A/B split is supported for NP I (via search of the PRC annex); for NP III/IV it rests on brainedapp alone.
2. NP II internal split (brainedapp: 50/50) and NP V part structure: unverified/UNKNOWN.
3. Names of NP I-V under the 2006 and 2017 TOS, and what the 2017 reclassification of NP I and II changed: UNKNOWN.
4. Conflicting NP III-V naming across sites (Part A/B/C style vs PRC subject titles).
5. Whether options are exactly 4; exact time per test; exam-day schedule (sources conflict).
6. Exam dates UNKNOWN for May 2023, Nov 2023, Nov 2024, Nov 2025 and exact Aug 2026 days; no May 2026 sitting found.
7. Nov 2025 topnotcher rating conflict (93.80% vs 88.50%); Inquirer "60% to 74%" headline unexplained.
8. All exam statistics are second-hand relays of PRC releases.
9. Delegation guidance is US-based; Philippine delegation rules UNKNOWN here.
10. The equal 20% weight per NP is INFERRED from 100 of 500 items.
