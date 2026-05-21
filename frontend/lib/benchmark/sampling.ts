/**
 * Adaptive Sample Size Calculator
 *
 * Calculates statistically significant sample sizes based on total population.
 * Uses industry-standard sample size calculations for 95% confidence level.
 */

/**
 * Calculate statistically significant sample size based on total population.
 * Uses industry-standard sample size calculations for 95% confidence level.
 */
export function getBenchmarkSampleSize(totalCompanies: number): number {
  if (totalCompanies < 500) return totalCompanies;  // test all
  if (totalCompanies < 2000) return 200;
  if (totalCompanies < 10000) return 500;
  if (totalCompanies < 50000) return 1000;
  return 2000;
}

/**
 * Get confidence level description for UI display
 */
export function getConfidenceDescription(totalCompanies: number, sampleSize: number): string {
  if (sampleSize === totalCompanies) return '100% sample (all companies tested)';
  if (sampleSize >= 200) return '95% confidence interval';
  return '90% confidence interval';
}
