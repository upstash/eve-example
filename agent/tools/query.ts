import { defineTool } from "eve/tools";
import { z } from "zod";
import { hnIndex, HN_SCHEMA_DOC } from "../lib/hn-index.ts";

/**
 * Generic pass-through for `index.query()` on the `hn` index. The model
 * authors the full Upstash Redis Search query-options object; we forward it
 * verbatim to the SDK and return the raw results.
 */
export default defineTool({
  description: `Run an Upstash Redis Search QUERY against the HackerNews "hn" index and return matching documents.
You author the raw query-options object (filter, select, limit, offset, orderBy, scoreFunc, highlight) and it is passed straight to index.query(...).
The full filter/operator syntax is in the system prompt.

${HN_SCHEMA_DOC}`,
  inputSchema: z.object({
    filter: z.any().optional().describe("Filter tree, e.g. { title: { $smart: 'rust' } } or { $and: [...] }. Omit to match all."),
    select: z.any().optional().describe("Field projection, e.g. { title: true, score: true }. {} = keys only. Omit = full document."),
    limit: z.number().int().optional().describe("Max documents to return."),
    offset: z.number().int().optional().describe("Number of results to skip (pagination)."),
    orderBy: z.any().optional().describe("Sort, e.g. { score: 'DESC' }. Mutually exclusive with scoreFunc."),
    scoreFunc: z.any().optional().describe("Relevance score modifier, e.g. { field: 'score', modifier: 'LOG1P' }."),
    highlight: z.any().optional().describe("Highlighting config, e.g. { fields: ['title'], preTag: '<mark>', postTag: '</mark>' }."),
  }),
  async execute(options) {
    // Forward the model-authored options verbatim to the SDK.
    return await hnIndex.query(options as Parameters<typeof hnIndex.query>[0]);
  },
});
