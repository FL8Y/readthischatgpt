# Measures of Variability — Nursing Research

## Purpose

Variability describes how spread out observations are. A central value without spread can be misleading because two samples may have the same mean but very different distributions. The appropriate measure depends on data type, distribution, outliers, and the question.

## Main measures

| Measure | Meaning | Units / interpretation | Caution |
|---|---|---|---|
| **Range** | Maximum minus minimum; sometimes reported as the minimum-to-maximum span. | Same units as the data; describes total observed span. | Uses only extremes and is sensitive to outliers and sample size. State which definition is used. |
| **Interquartile range (IQR)** | Third quartile (Q3) minus first quartile (Q1). | Same units as data; spread of the middle 50%. | Does not describe the tails; quartile conventions may differ slightly across software. |
| **Variance** | Mean squared deviation from the mean, with denominator depending on population/sample context. | Squared units; useful in statistical formulas. | Less intuitive because units are squared. Sample variance commonly uses n−1. |
| **Standard deviation (SD)** | Square root of variance. | Same units as the data; typical spread around the mean under the distribution's context. | Does not imply that all observations fall within one SD; the familiar 68–95–99.7 rule applies approximately to a normal distribution. |
| **Coefficient of variation (CV)** | SD divided by mean, often expressed as a percentage. | Relative variability, typically for ratio-scale data with a meaningful nonzero mean. | Can be misleading or undefined when the mean is near zero or negative; do not use indiscriminately. |
| **Median absolute deviation (MAD)** | Median of absolute deviations from the median. | Robust measure of spread. | Software may report raw or scaled MAD; state the definition when comparing values. |

## Choosing a measure

- Use **SD with mean** when numeric data are reasonably symmetric and the mean is meaningful.
- Use **IQR with median** for skewed numeric data or when extreme values make SD less representative.
- Use **range** for a simple description of observed extremes, but do not rely on it alone.
- For categorical data, summarize variability through category frequencies/proportions rather than SD of arbitrary numeric codes.
- In inferential analysis, use uncertainty measures such as standard errors and confidence intervals for estimates; these are not the same as the SD of individual observations.

## SD versus standard error

These terms are often confused:
- **Standard deviation (SD):** describes spread among individual observations.
- **Standard error (SE):** describes estimated variability of a statistic across repeated samples under a model/design; it is used to quantify precision of estimates.
A small SE does not mean individuals have little variation. A large sample can yield a small SE even when the individual observations have substantial SD.

## Interpreting variability

- Two units with the same mean outcome may differ substantially in variability and patient-level experience.
- High variability can reflect true heterogeneity, measurement inconsistency, mixed subgroups, or errors; inspect the context.
- Low variability is not automatically good: it may reflect a restricted sample, limited measurement sensitivity, or data problems.
- A narrow confidence interval describes precision of an estimate, not the spread of individual patient values.

## Common errors

- Treating SD and SE as synonyms.
- Comparing SDs without considering units and distribution.
- Using CV when the mean is near zero or the scale lacks a meaningful zero.
- Assuming the empirical 68–95–99.7 rule applies to all distributions.
- Reporting only a central value and hiding the spread.
- Deleting an outlier without a documented reason.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- NIST, **Confidence limits for the mean**: https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm
- OpenStax, **Introductory Statistics 2e**: https://openstax.org/details/books/introductory-statistics-2e

## PNLE high-yield review

- Range = extremes; IQR = middle 50%; variance = squared deviations; SD = square root of variance.
- SD describes observations; SE describes precision of a statistic.
- Mean/SD often pair for symmetric data; median/IQR often pair for skewed data.
- A confidence interval is not a range containing 95% of individual observations.
- Variability must be interpreted with the distribution and measurement scale.

## Scope note

Definitions can vary slightly by software and convention, especially quartiles and scaled MAD. State methods clearly and use consistent definitions.