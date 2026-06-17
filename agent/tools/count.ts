import { defineTool } from "eve/tools";
import { z } from "zod";
import { hnIndex, HN_SCHEMA_DOC } from "../lib/hn-index.ts";

/**
 * Generic pass-through for `index.count()` on the `hn` index. Returns the
 * number of documents matching a filter without fetching them.
 */
export default defineTool({
  description: `Run an Upstash Redis Search COUNT against the HackerNews "hn" index. Returns the number of documents matching a filter, without fetching them.
You author the raw { filter } object and it is passed straight to index.count(...). Omit filter (or pass {}) to count every document.
The full filter/operator syntax is in the system prompt.

${HN_SCHEMA_DOC}`,
  inputSchema: z.object({
    filter: z.any().optional().describe("Filter tree, e.g. { by: { $eq: 'pg' } }. Omit to count all documents."),
  }),
  async execute({ filter }) {
    return await hnIndex.count({ filter: (filter ?? {}) as Parameters<typeof hnIndex.count>[0]["filter"] });
  },
});
