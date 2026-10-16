# Research Data Analysis — Research B

## Purpose and alignment

Analysis turns collected data into findings that answer the research question. The analysis plan should align with the design, outcomes, measurement levels, sampling, protocol, and intended inference. Specify primary outcomes and analyses in advance when possible, document justified deviations, and avoid selecting only analyses that produce favorable results.

Analysis differs by approach: quantitative analysis summarizes or models numerical/categorical data; qualitative analysis interprets text, observations, or other non-numeric material systematically; mixed-methods research must explain how the strands are integrated.

## Core workflow

1. **Return to the question and protocol.** Identify primary/secondary outcomes, variables, hypotheses if applicable, and prespecified analyses.
2. **Check data provenance and quality.** Verify source records, coding, units, ranges, duplicates, and logical consistency. Preserve an audit trail; never change valid observations just because they are unexpected.
3. **Describe the sample and missingness.** Report participant flow, baseline characteristics as appropriate, missing data, exclusions, and attrition.
4. **Explore distributions and assumptions.** Review scale/type, shape, outliers, independence, model assumptions, and possible data-entry errors. Do not remove outliers automatically.
5. **Choose methods that match the question and data.** Descriptive summaries may be enough for some questions; estimation, hypothesis testing, regression, qualitative coding, or synthesis may be needed for others.
6. **Estimate and communicate uncertainty.** Where appropriate, report effect estimates with confidence intervals and exact p-values rather than only “significant/not significant.”
7. **Check robustness and alternative explanations.** Consider confounding, bias, missingness, model sensitivity, and whether conclusions depend on analytic choices.
8. **Interpret in context.** Distinguish statistical from clinical importance, association from causation, and sample findings from broader population claims.
9. **Report transparently.** State methods, assumptions, deviations, limitations, and relevant results, including nonsignificant or unfavorable findings.

## Match method to data and question

| Data/question | Common summary or method | Caution |
|---|---|---|
| Categorical data | Counts, proportions, cross-tabulations; suitable association tests/models | Check expected cell counts, denominator, and whether categories are independent. |
| Continuous data | Mean/SD when suitable; median/IQR for skewed distributions; regression or group comparisons as appropriate | Summaries and tests depend on distribution, design, scale, and assumptions. |
| Ordinal data | Frequencies/percentages, medians, ordinal models or other justified methods | Do not automatically treat ordinal categories as equally spaced. |
| Time-to-event data | Survival curves and suitable time-to-event models | Account for censoring and model assumptions. |
| Qualitative data | Systematic coding, theme/category development, reflexivity, evidence-rich interpretation | Do not reduce analysis to unsupported theme labels or cherry-picked quotations. |
| Multiple studies | Structured synthesis; meta-analysis only when appropriate | Studies may differ in populations, interventions, outcomes, methods, and risk of bias. |

## Effect estimates and uncertainty

An estimate describes the magnitude and direction of a result; a confidence interval communicates statistical uncertainty under the method's assumptions. For common effect measures, the null value differs: a difference measure often has a null of 0, while a ratio measure such as a risk ratio or odds ratio commonly has a null of 1. Interpret the measure in the correct direction and units.

A p-value is not the probability that the null hypothesis is true. Statistical significance alone does not establish clinical importance, causation, or absence of bias. Confidence intervals can show whether the data are compatible with a range of effects and whether clinically important benefit or harm remains plausible.

## Bias, missing data, and analytical flexibility

- Missing data can bias results if the probability of missingness is related to observed or unobserved information; report extent and handling.
- Confounding can distort exposure-outcome relationships in observational studies; adjustment is not automatically sufficient.
- Multiple comparisons increase the chance of false-positive findings; account for multiplicity where relevant.
- Post hoc analyses can generate useful hypotheses but should be labeled exploratory.
- Selective reporting, p-hacking, changing outcomes after inspecting data, and excluding inconvenient observations undermine trust.
- Meta-analysis can mislead if incompatible studies, bias, or heterogeneity are ignored.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- Cochrane Handbook, Chapter 6, **Choosing effect measures and computing estimates of effect**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06
- Cochrane Handbook, Chapter 10, **Analysing data and undertaking meta-analyses**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-10
- Cochrane Handbook, Chapter 15, **Interpreting results and drawing conclusions**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-15
- EQUATOR Network, **Reporting guidelines**: https://www.equator-network.org/reporting-guidelines/

## PNLE high-yield review

- Align the analysis with the question, design, variable type, and protocol.
- Check data quality and missingness before interpreting results.
- Report effect magnitude and uncertainty, not just a p-value.
- Statistical significance does not automatically mean clinical significance.
- Avoid unsupported causal claims from observational associations.
- Transparent reporting includes nonsignificant results, limitations, and justified deviations.

## Scope note

Analysis methods require assumptions and context. Consult a qualified statistician or methods specialist for complex models, high-stakes decisions, or analyses beyond the team's competence.