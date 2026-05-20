/**
 * ICP Scorer
 *
 * Scores companies against Ideal Customer Profile criteria.
 */

import { ProspectCompany, ICPConfig } from './types';

/**
 * Default scoring weights if not specified.
 */
const DEFAULT_WEIGHTS = {
  industry: 0.35,
  size: 0.30,
  location: 0.20,
  technology: 0.15,
};

/**
 * Score industry match.
 */
function scoreIndustry(
  company: ProspectCompany,
  config: ICPConfig
): number {
  if (!config.target_industries || config.target_industries.length === 0) {
    return 100; // No filter = full score
  }

  if (!company.industry) {
    return 0;
  }

  const companyIndustry = company.industry.toLowerCase();
  const matchesIndustry = config.target_industries.some((targetIndustry) =>
    companyIndustry.includes(targetIndustry.toLowerCase())
  );

  return matchesIndustry ? 100 : 0;
}

/**
 * Score employee size match.
 */
function scoreSize(company: ProspectCompany, config: ICPConfig): number {
  if (
    config.target_employee_min === undefined &&
    config.target_employee_max === undefined
  ) {
    return 100; // No filter = full score
  }

  if (!company.employee_count) {
    return 0;
  }

  const { target_employee_min, target_employee_max } = config;
  const count = company.employee_count;

  // Check if in range
  const inRange =
    (target_employee_min === undefined || count >= target_employee_min) &&
    (target_employee_max === undefined || count <= target_employee_max);

  if (inRange) {
    return 100;
  }

  // Partial credit for being close to range
  if (target_employee_min !== undefined && count < target_employee_min) {
    const distance = target_employee_min - count;
    const percentageOff = distance / target_employee_min;
    return Math.max(0, 100 - percentageOff * 100);
  }

  if (target_employee_max !== undefined && count > target_employee_max) {
    const distance = count - target_employee_max;
    const percentageOff = distance / target_employee_max;
    return Math.max(0, 100 - percentageOff * 100);
  }

  return 0;
}

/**
 * Score location match.
 */
function scoreLocation(
  company: ProspectCompany,
  config: ICPConfig
): number {
  if (!config.target_locations) {
    return 100; // No filter = full score
  }

  const {
    cities = [],
    states = [],
    countries = [],
  } = config.target_locations;

  if (cities.length === 0 && states.length === 0 && countries.length === 0) {
    return 100;
  }

  // Check city match (highest priority)
  if (cities.length > 0 && company.city) {
    const cityMatch = cities.some(
      (city) => city.toLowerCase() === company.city?.toLowerCase()
    );
    if (cityMatch) return 100;
  }

  // Check state match
  if (states.length > 0 && company.state) {
    const stateMatch = states.some(
      (state) => state.toLowerCase() === company.state?.toLowerCase()
    );
    if (stateMatch) return 80;
  }

  // Check country match
  if (countries.length > 0 && company.country) {
    const countryMatch = countries.some(
      (country) => country.toLowerCase() === company.country?.toLowerCase()
    );
    if (countryMatch) return 60;
  }

  return 0;
}

/**
 * Score technology match.
 */
function scoreTechnology(
  company: ProspectCompany,
  config: ICPConfig
): number {
  if (!config.target_technologies || config.target_technologies.length === 0) {
    return 100; // No filter = full score
  }

  if (!company.technologies || company.technologies.length === 0) {
    return 0;
  }

  const companyTechs = company.technologies.map((t) => t.toLowerCase());
  const targetTechs = config.target_technologies.map((t) => t.toLowerCase());

  // Count how many target technologies match
  const matchCount = targetTechs.filter((target) =>
    companyTechs.some((companyTech) => companyTech.includes(target))
  ).length;

  // Score based on percentage of technologies matched
  return (matchCount / targetTechs.length) * 100;
}

/**
 * Score a company against ICP criteria.
 *
 * @param company - Company to score
 * @param config - ICP configuration
 * @returns Score (0-100) and breakdown by category
 */
export function scoreCompanyICP(
  company: ProspectCompany,
  config: ICPConfig
): {
  score: number;
  breakdown: {
    industry_match: number;
    size_match: number;
    location_match: number;
    technology_match: number;
  };
} {
  const weights = config.weights || DEFAULT_WEIGHTS;

  // Calculate component scores
  const industryScore = scoreIndustry(company, config);
  const sizeScore = scoreSize(company, config);
  const locationScore = scoreLocation(company, config);
  const technologyScore = scoreTechnology(company, config);

  // Calculate weighted total
  const totalScore =
    industryScore * weights.industry +
    sizeScore * weights.size +
    locationScore * weights.location +
    technologyScore * weights.technology;

  return {
    score: Math.round(totalScore),
    breakdown: {
      industry_match: Math.round(industryScore),
      size_match: Math.round(sizeScore),
      location_match: Math.round(locationScore),
      technology_match: Math.round(technologyScore),
    },
  };
}
