import { defineTool } from "eve/tools";
import { z } from "zod";
import { hnIndex, HN_SCHEMA_DOC, SEARCH_SKILL } from "../lib/hn-index.ts";

/**
 * Generic pass-through for `index.aggregate()` on the `hn` index. Runs metric
 * and bucket aggregations (analytics) over matching documents.
 */
export default defineTool({
  description: `Run an Upstash Redis Search AGGREGATE against the HackerNews "hn" index for analytics (averages, sums, min/max, grouping, histograms, percentiles).
You author the raw aggregate-options object ({ filter?, aggregations }) and it is passed straight to index.aggregate(...).
Metric aggs: $avg $sum $min $max $count $cardinality $stats $extendedStats $percentiles. Bucket aggs: $terms $range $histogram $facet (nest metrics under $aggs).
Load the "${SEARCH_SKILL}" skill (via load_skill) for the full aggregation syntax before writing aggregations.

${HN_SCHEMA_DOC}`,
  inputSchema: z.object({
    filter: z.any().optional().describe("Optional filter applied before aggregating, e.g. { type: { $eq: 'story' } }."),
    aggregations: z
      .any()
      .describe("Aggregation spec, e.g. { avg_score: { $avg: { field: 'score' } } } or { by_type: { $terms: { field: 'type' } } }."),
  }),
  async execute(options) {
    return await hnIndex.aggregate(options as Parameters<typeof hnIndex.aggregate>[0]);
  },
});
