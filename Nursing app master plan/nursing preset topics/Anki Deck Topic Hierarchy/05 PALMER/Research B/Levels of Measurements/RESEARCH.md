# Levels of Measurement — Research B

| Level | Defining property | Example | Typical summaries |
|---|---|---|---|
| Nominal | Categories without order | Blood group, diagnosis | Counts, percentages, mode |
| Ordinal | Ordered categories; unequal/unknown gaps | Satisfaction category, pain category | Counts, median, percentiles |
| Interval | Equal units, no meaningful absolute zero | Celsius temperature | Mean/SD if assumptions fit |
| Ratio | Equal units and meaningful zero | Weight, duration, number of falls | Mean/SD or median/IQR as distribution warrants |

## Application
Measurement level constrains analysis, but design, distribution, sample size, independence, and assumptions also matter. Assigning numeric codes to nominal categories does not make them continuous. A 0–10 rating is often treated as approximately numeric, but ordinal assumptions should be acknowledged.

## Common errors
Do not average blood types; do not assume equal spacing between ordinal categories; do not interpret 0°C as absence of temperature; do not choose a statistical test from measurement level alone.

## References
- NIST/SEMATECH: https://www.itl.nist.gov/div898/handbook/
- OpenStax Introductory Statistics: https://openstax.org/details/books/introductory-statistics

## Choosing a summary or analysis

First identify the variable's meaning, then consider distribution, design, and assumptions. Nominal categories are summarized with counts/proportions; ordinal categories preserve order but not assumed equal gaps; interval values support meaningful differences but not ratios to a true zero; ratio values have a meaningful zero. These are properties of the measurement scale, not guarantees that a particular parametric test is suitable.

### Nursing examples and traps

- **Nominal:** ward, blood type, diagnosis category, presence/absence of an event. Numeric labels are identifiers, not quantities.
- **Ordinal:** triage category, Likert item, pain-severity category. Report distributions and use methods that respect ordering; do not automatically average one ordinal item.
- **Interval:** Celsius temperature. Differences are meaningful, but 20°C is not “twice as hot” as 10°C.
- **Ratio:** length of stay, weight, elapsed time, or event count. A ratio scale still may be skewed or have many zeros, so use suitable summaries/models.

A binary 0/1 variable is categorical, although its sample mean equals the observed proportion of 1s. A multi-item score may sometimes be analyzed approximately as continuous if instrument structure and assumptions justify it; explain the rationale. Reliability and validity concern measurement quality and are separate from level of measurement.

## Decision sequence

1. State the construct and operational definition.
2. Identify whether categories have order, equal intervals, and meaningful zero.
3. Inspect distribution, missingness, outliers, sample design, and dependence.
4. Select a summary/model suitable to the scale and question.
5. Report coding, units, tool, and limitations.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- OpenStax, **Introductory Statistics 2e**: https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling
