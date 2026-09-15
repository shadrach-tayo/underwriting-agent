/**
 * Industry options sourced from data/gold_set/applicants.jsonl.
 * Keep values lowercase — program routing matches on applicant.industry.lower().
 */

export const GOLD_SET_INDUSTRIES = [
  "administrative support",
  "arts entertainment recreation",
  "construction",
  "food services",
  "gambling",
  "healthcare",
  "manufacturing",
  "other services",
  "passive investment holding",
  "professional services",
  "retail trade",
  "speculative real estate",
  "transportation",
  "wholesale trade",
] as const

export type GoldSetIndustry = (typeof GOLD_SET_INDUSTRIES)[number]

/** Mirrors agents.program_routing.INELIGIBLE_INDUSTRIES for playground labeling. */
export const INELIGIBLE_INDUSTRIES = new Set<string>([
  "gambling",
  "speculative real estate",
  "passive investment holding",
])

export function formatIndustryLabel(industry: string) {
  return industry
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
