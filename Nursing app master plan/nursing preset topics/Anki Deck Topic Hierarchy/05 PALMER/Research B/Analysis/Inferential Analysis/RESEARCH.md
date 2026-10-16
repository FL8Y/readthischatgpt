# Inferential Analysis — Nursing Research

## Purpose

Inferential statistics use sample data and a statistical model/design to estimate population quantities or evaluate hypotheses. Inference is conditional on the sampling process, design, measurement quality, assumptions, and analysis choices. A statistically correct calculation cannot repair a biased sample or a design that does not support the claimed inference.

## Key concepts

- **Population parameter:** quantity of interest in the target population (e.g., population mean or event risk).
- **Sample statistic / estimate:** value calculated from the observed sample to estimate a population quantity.
- **Point estimate:** a single estimated value, such as a mean difference or risk ratio.
- **Confidence interval (CI):** interval produced by a method with a stated long-run coverage property under its assumptions; it communicates statistical uncertainty.
- **Standard error (SE):** estimated standard deviation of a statistic's sampling distribution; smaller SE generally means greater precision for that estimate.
- **Null hypothesis (H₀):** specified no-difference/no-association/no-effect condition under the model.
- **P-value:** probability, under the specified null model and assumptions, of obtaining data at least as incompatible with the null as observed. It is not the probability that H₀ is true.
- **Alpha (α):** prespecified Type I error threshold; Type I error is rejecting a true null.
- **Beta (β):** Type II error probability under a specified alternative; power is 1 − β.
- **Effect size:** magnitude and direction of a difference or association.
- **Statistical significance:** result meeting a prespecified decision threshold; not synonymous with clinical importance.

## Common inferential approaches

Method choice depends on the question, design, variable type, distribution, independence, and assumptions. Examples include:
- confidence intervals for means, proportions, differences, and ratios;
- t-tests or suitable alternatives for comparisons of means;
- chi-square or exact methods for categorical associations when assumptions warrant;
- correlation to quantify association between variables, not establish causation;
- regression to model outcomes and adjust for specified variables under stated assumptions;
- time-to-event methods for event timing and censoring;
- meta-analysis to combine sufficiently comparable study estimates under defensible assumptions.

This is a concept list, not a universal decision tree. The same named test may be inappropriate if observations are paired, clustered, repeated, severely non-normal in a small sample, or otherwise violate its assumptions.

## Confidence intervals and p-values

A confidence interval communicates the range of values compatible with the data and method; narrower intervals generally indicate greater precision. In the frequentist interpretation, a 95% method captures the fixed true parameter in about 95% of repeated samples under its assumptions. It does not mean there is a 95% probability that this particular computed interval contains the fixed parameter.

For common effect measures, the null value is often 0 for difference measures and 1 for ratio measures. Whether a CI excludes the null is related to a corresponding two-sided test at the same nominal level when the procedures are aligned. Still, clinical interpretation requires effect magnitude, precision, harms, patient priorities, and context.

Do not interpret:
- p < 0.05 as proof the hypothesis is true or the effect is important;
- p ≥ 0.05 as proof there is no effect;
- a CI as a guarantee that the true value is inside the particular interval;
- statistical adjustment as proof that confounding is eliminated;
- an association as proof of causation.

## Assumptions and validity checks

Before interpreting an inferential result, ask:
1. Was the sample obtained in a way that supports the intended population inference?
2. Are the outcome/exposure definitions and measurements appropriate?
3. Are independence, distributional, variance, model-fit, and other method-specific assumptions reasonable?
4. Are missing data, outliers, clustering, repeated measures, confounding, and multiplicity addressed?
5. Were the main outcomes and analyses prespecified, or are they exploratory?
6. Are effect estimates and uncertainty reported clearly?
7. Does the conclusion match the design and evidence, without overclaiming causality?

## Clinical and nursing interpretation

Statistical inference should support, not replace, clinical judgment. Consider whether the effect is clinically meaningful, whether uncertainty includes both benefit and harm, whether the population resembles the patient or setting, and whether the study design supports the claim. For patient-safety decisions, weigh severity and urgency as well as statistical evidence.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**, including confidence intervals and hypothesis testing: https://www.itl.nist.gov/div898/handbook/
- NIST, **Confidence limits for the mean**: https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm
- Cochrane Handbook, Chapter 6, **Choosing effect measures and computing estimates of effect**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06
- Cochrane Handbook, Chapter 15, **Interpreting results and drawing conclusions**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15

## PNLE high-yield review

- Inferential analysis estimates or tests beyond the observed sample; validity depends on design and assumptions.
- SE concerns estimate precision; CI communicates uncertainty; p-value is not the probability that H₀ is true.
- Effect size and clinical relevance matter even when p-values are reported.
- A nonsignificant result does not prove no effect.
- Match tests to data type, design, and assumptions; do not choose a test based only on habit.

## Scope note

Complex inference requires suitable statistical expertise and transparent reporting of assumptions, exclusions, and sensitivity analyses.