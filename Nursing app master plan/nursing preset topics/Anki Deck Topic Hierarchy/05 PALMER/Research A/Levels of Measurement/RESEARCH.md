# Levels of Measurement — Nursing Research

## Four levels
| Level | Characteristics | Examples | Suitable summaries (typical) |
|---|---|---|---|
| Nominal | Categories, no inherent order | Blood type, ward, diagnosis category | Counts, proportions, mode |
| Ordinal | Ordered categories; gaps not known equal | Pain category, satisfaction rating, triage category | Counts, median, percentiles; methods suited to ranks |
| Interval | Equal units, no meaningful absolute zero | Celsius temperature | Mean/SD and many parametric methods if assumptions fit |
| Ratio | Equal units and meaningful zero | Weight, age, duration, count | Mean/SD, ratios, and other numeric methods if assumptions fit |

## Nursing implications
The measurement level constrains valid summaries and analyses, but distribution, study design, sample size, independence, and assumptions also matter. A numeric code assigned to categories does not turn nominal data into quantitative data. A 0–10 pain rating is often treated as approximately numeric in practice, but its ordinal nature and analytic assumptions should be acknowledged.

## Common errors
- Using a mean for arbitrary labels such as blood type.
- Assuming ordinal category gaps are equal.
- Treating Celsius zero as absence of temperature.
- Choosing a statistical test solely from measurement level without considering design and assumptions.

## References
- NIST/SEMATECH, e-Handbook of Statistical Methods: https://www.itl.nist.gov/div898/handbook/
- OpenStax, Introductory Statistics: https://openstax.org/details/books/introductory-statistics

## Deeper interpretation and analysis implications

Measurement level is a property of how a variable is defined and recorded—not simply whether numbers appear in the data file. A diagnosis coded 1, 2, and 3 remains nominal if the codes are labels. Before choosing a summary or test, consider measurement level together with distribution, design, sample size, dependence between observations, and the question.

### Examples from nursing research

- **Nominal:** type of wound, blood group, ward type, or presence/absence of a documented event. Use counts and proportions; do not average arbitrary category codes.
- **Ordinal:** triage category, Likert response, pressure-injury stage, or a pain-severity category. Preserve the order; report category distributions and use rank/ordinal methods when suitable. Do not assume the difference between adjacent categories is equal.
- **Interval:** Celsius temperature has equal degree increments but zero does not mean absence of thermal energy. Differences are interpretable; ratios such as “twice as hot” are not valid on the Celsius scale.
- **Ratio:** duration, weight, number of falls, or length of stay has a meaningful zero in its defined scale. Ratios may be meaningful, but the distribution and study design still determine appropriate analysis.

### Important caveats

- A single Likert-type item is ordinal by definition; researchers sometimes analyze summed multi-item scales as approximately continuous when justified by instrument properties and analytic assumptions. State the decision and do not assume all scales qualify.
- Binary variables are categorical even when coded 0/1. A proportion can be meaningful; the mean of a 0/1 variable equals the observed proportion, but this does not make the underlying variable continuous.
- Time and count variables may be ratio-level but skewed or overdispersed. Measurement level alone does not justify a normal-theory method.
- A measurement instrument's reliability and validity are separate from its measurement level. A variable can be correctly classified as ordinal yet still be measured poorly.

## Quick method-selection sequence

1. Identify what the values mean and whether order/equal intervals/meaningful zero exist.
2. Define the estimand or descriptive question (frequency, typical value, difference, association, time-to-event).
3. Check distribution, outliers, sample design, paired/repeated structure, and assumptions.
4. Choose summaries and analysis that respect both the measurement level and design.
5. Report operational definitions, coding, instrument, and limitations.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- OpenStax, **Introductory Statistics 2e**, data types and sampling: https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling
- Cochrane Handbook, Chapter 6, **Choosing effect measures and computing estimates of effect**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06
