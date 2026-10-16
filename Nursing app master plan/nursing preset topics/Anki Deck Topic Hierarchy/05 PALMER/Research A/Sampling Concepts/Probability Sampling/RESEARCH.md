# Probability Sampling — Nursing Research

## Definition

Probability sampling uses a random selection procedure so each eligible population unit has a known, nonzero probability of selection under the design. When the frame, implementation, response, and analysis are appropriate, this supports design-based estimation of population quantities and sampling uncertainty. It does not guarantee that the realized sample perfectly matches the population or eliminate nonresponse and measurement bias.

## Main methods

| Method | Procedure | Strength / use | Risks and cautions |
|---|---|---|---|
| **Simple random** | Select units randomly from a complete, suitable frame. | Clear selection probabilities and straightforward design. | Requires a frame; undercoverage and nonresponse can still bias results. |
| **Systematic** | Random start, then every kth entry in an ordered frame. | Easy to implement and spreads selection across the list. | Periodic patterns in the list can interact with the interval and distort selection. |
| **Stratified** | Divide population into relevant strata, then randomly sample within each. | Ensures inclusion of important groups and may improve precision. | Strata must be defined well; analysis may require weights if allocation is disproportionate. |
| **Cluster** | Randomly select clusters (e.g., facilities or wards), then study all or some units within selected clusters. | Can reduce cost when participants are geographically dispersed. | Units within clusters may be correlated; design effects and clustering must be handled in analysis. |
| **Multistage** | Randomly select at successive levels (e.g., regions, facilities, then patients). | Flexible for large, geographically distributed populations. | Selection probabilities and weights may be more complex; analysis must reflect every stage. |

## Essential implementation details

1. Define the target population, accessible population, sampling unit, and frame.
2. Set inclusion/exclusion criteria before selection.
3. Specify the randomization/selection procedure so it can be reproduced and audited.
4. Record each stage of selection, replacement/substitution rules, and any deviations.
5. Track nonresponse and compare responders/nonresponders on available relevant characteristics where appropriate.
6. Use weights and design-aware variance estimation when the design requires them.
7. Report the actual sampling method, frame coverage, response rate, clustering/stratification, and limitations.

## Sample size and precision

Sample size should be justified by the study objective. For estimation, consider desired precision, confidence level, variability, design effects, expected nonresponse, and population structure. For hypothesis testing, consider clinically meaningful effect, variability, alpha, power, and design. Cluster sampling may require a larger sample than simple random sampling to achieve similar precision because observations within clusters may be correlated.

There is no universal sample size that guarantees representativeness or sufficient power. A large sample drawn from a flawed frame may remain biased.

## Bias and inference

Probability sampling addresses selection probabilities; it does not correct every research problem. Coverage error, nonresponse, attrition, measurement error, protocol deviations, and analysis errors can still distort findings. A response rate alone does not establish absence of nonresponse bias; the relationship between response and relevant characteristics matters.

## Nursing example

To estimate the prevalence of a safety practice across hospitals, a researcher could stratify hospitals by region or facility type, randomly select hospitals within strata, and then select nurses or units using a defined multistage procedure. The analysis should account for stratification, clustering, and selection probabilities; treating all observations as a simple random sample may underestimate uncertainty.

## Sources

- OpenStax, **Introductory Statistics 2e**, Section 1.2, sampling methods: https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling
- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- Cochrane Handbook: https://training.cochrane.org/handbook

## PNLE high-yield review

- Probability sampling means known, nonzero selection probabilities—not a guarantee of no bias.
- Stratified sampling takes samples within strata; cluster sampling randomly selects groups.
- Systematic sampling uses a random start and fixed interval; watch for periodicity.
- Multistage designs require analysis that reflects all selection stages.
- Frame coverage, nonresponse, clustering, and weighting affect inference.

## Scope note

Use methods appropriate to the population and resources, and involve a statistician when complex sampling or design-based estimation is required.