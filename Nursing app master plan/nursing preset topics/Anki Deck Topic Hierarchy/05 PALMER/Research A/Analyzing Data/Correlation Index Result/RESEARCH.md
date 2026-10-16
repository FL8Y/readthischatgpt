# Correlation Coefficients and Interpretation — Nursing Research

## Meaning

Correlation quantifies the direction and strength of association between variables. It does not, by itself, establish that one variable causes another. Interpretation depends on the coefficient, measurement scale, data pattern, sample, outliers, and design.

## Common coefficients

| Coefficient | Typical use | Interpretation / caution |
|---|---|---|
| **Pearson's r** | Linear association between two numeric variables under appropriate assumptions. | Ranges from −1 to +1; sensitive to outliers and may miss nonlinear relationships. |
| **Spearman's rho (ρ)** | Rank-based monotonic association; useful for ordinal data or when Pearson's assumptions are unsuitable. | Ranges from −1 to +1; detects monotonic association, not every possible nonlinear pattern. |
| **Kendall's tau (τ)** | Rank-based association, often useful for ordinal data and some sample structures. | Interpretation and magnitude differ from Pearson r; ties and sample characteristics matter. |
| **Point-biserial correlation** | Association between a continuous variable and a genuinely dichotomous variable under suitable conditions. | Equivalent to Pearson correlation with 0/1 coding in the standard setup; interpret coding and assumptions. |

## Direction and strength

- **Positive correlation:** higher values of one variable tend to occur with higher values of the other.
- **Negative correlation:** higher values of one variable tend to occur with lower values of the other.
- **Near zero:** little linear association for Pearson r; it does not rule out a nonlinear relationship.
- **Magnitude:** values closer to −1 or +1 indicate stronger association for Pearson r, but practical interpretation depends on field, measurement reliability, range restriction, and context.

Do not use a universal “weak/moderate/strong” cutoff without explaining the convention. A small correlation can matter in a large population or as part of a broader model; a large correlation may be clinically irrelevant or driven by bias.

## Correlation coefficient versus coefficient of determination

For Pearson's r in a simple linear context, **r²** is the proportion of sample variation in one variable associated with the fitted linear relationship with the other variable. It is not the percentage of one variable causally explained by the other, and its interpretation is more limited outside the simple linear setting.

## Essential checks before interpreting

1. Plot the data (e.g., scatterplot) to inspect shape, outliers, clusters, and nonlinearity.
2. Check whether the coefficient matches the scale and research question.
3. Consider measurement error, restricted range, selection bias, and confounding.
4. Report the coefficient with sample size and, where appropriate, confidence interval and p-value.
5. Interpret magnitude and uncertainty, not only statistical significance.
6. Avoid causal language unless the design and assumptions support causal inference.

## Common pitfalls

- **Correlation is not causation:** a third variable may influence both, or the direction may be reversed.
- **Outliers:** one or two points can strongly affect Pearson r.
- **Nonlinear pattern:** Pearson r may be near zero even when a clear curved relationship exists.
- **Restricted range:** limiting the sample's range can reduce observed correlation.
- **Ecological fallacy:** a group-level association may not hold for individuals.
- **Multiple testing:** testing many pairs increases false-positive risk.
- **Coding errors:** reverse-coded scales or inconsistent units can alter direction and magnitude.

## Nursing example

A study finds that nurse staffing level and patient falls are correlated. This association alone cannot prove staffing caused the difference. Patient acuity, unit type, reporting practices, and other factors may influence both staffing and falls. Examine the design, measurement, temporal order, and confounder handling before drawing a causal conclusion.

## Sources

- NIST/SEMATECH, **e-Handbook of Statistical Methods**: https://www.itl.nist.gov/div898/handbook/
- OpenStax, **Introductory Statistics 2e**: https://openstax.org/details/books/introductory-statistics-2e
- Cochrane Handbook, Chapter 6, **Choosing effect measures and computing estimates of effect**: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06

## PNLE high-yield review

- Pearson r describes linear association; Spearman rho/Kendall tau are rank-based.
- Positive = same direction; negative = opposite direction.
- r near zero does not exclude nonlinear association.
- r² is not a causal percentage.
- Correlation alone does not establish causation; consider confounding, measurement, design, and outliers.

## Scope note

Coefficient choice and interpretation depend on data type, design, and assumptions. For complex data or causal questions, consult a statistician and use a suitable model.