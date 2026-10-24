import * as z from "zod/v4";

export const screeningModeSchema = z.literal("fodmap").optional();
export const fodmapAssessmentSchema = z.object({
  outcome: z.enum(["potential_concern", "no_listed_concern", "insufficient_information"]),
  rule_version: z.string(),
  ingredients_text: z.string().nullable(),
  precautionary_text: z.string().nullable(),
  evidence: z.array(z.object({
    rule_id: z.string(), matched_term: z.string(),
    context: z.enum(["declared", "precautionary"]),
    explanation: z.string(), source_urls: z.array(z.string()),
  })),
  uncertainties: z.array(z.string()),
  source_urls: z.array(z.string()),
});
export const screeningCoverageSchema = z.object({
  mode: z.literal("fodmap"),
  rule_version: z.string(),
  eligible_count: z.number().int(),
  assessed_count: z.number().int(),
  flagged_count: z.number().int(),
  unknown_count: z.number().int(),
  no_listed_concern_count: z.number().int(),
  unassessed_count: z.number().int(),
  detail_lookups: z.number().int(),
  detail_failures: z.number().int(),
  review_returned: z.number().int(),
  review_omitted: z.number().int(),
  partial: z.boolean(),
  limitation: z.string(),
});
