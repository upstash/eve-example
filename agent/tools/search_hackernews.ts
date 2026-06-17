import { defineTool } from "eve/tools";
import { Redis, s } from "@upstash/redis";
import { z } from "zod";

/**
 * Typed reference to the `hn` HackerNews search index in Upstash Redis.
 *
 * It's a HASH index (prefix `hn:`) over ~44M HackerNews items. The hash also
 * stores `url`/`id`, which aren't part of the indexed schema below. Read-only.
 */
const hnIndex = Redis.fromEnv().search.index({
  name: "hn",
  schema: s.object({
    title: s.string(), // story / comment title (TEXT)
    text: s.string(), // body text, mostly on comments & Ask/Show HN (TEXT)
    by: s.keyword(), // author username
    type: s.keyword(), // "story" | "comment" | "job" | "poll" | ...
    score: s.number("F64"), // HN points (upvotes)
    ndesc: s.number("F64"), // number of descendants (comment count)
    parent: s.number("F64"), // parent item id (0 for top-level)
    time: s.date(), // creation time
  }),
});

/**
 * Full-text RAG search over HackerNews. The model uses this to ground answers
 * in real HN items.
 */
export default defineTool({
  description:
    "Search HackerNews items (stories, comments, Ask/Show HN) by full text. " +
    "Returns the most relevant items (ranked by text relevance) grounded in " +
    "real HN data: title, author, points (upvotes), comment count, date, url " +
    "and a text snippet. Use this to answer any question about HackerNews " +
    "content, discussions, top stories on a topic, or what people said.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Natural-language search terms, e.g. 'rust async runtime'"),
    type: z
      .enum(["story", "comment", "job", "poll"])
      .optional()
      .describe(
        "Restrict to a single item type. Omit to search all types. Use 'story' " +
          "when the user asks about posts / top stories, 'comment' for opinions.",
      ),
    limit: z.number().int().min(1).max(20).default(5).describe("Max items to return."),
  }),
  async execute({ query, type, limit }) {
    // Match the query against both the title and body text.
    const textMatch = {
      $or: [{ title: { $smart: query } }, { text: { $smart: query } }],
    };
    const filter = type ? { $and: [textMatch, { type: { $eq: type } }] } : textMatch;

    // Always rank by text relevance — sorting purely by points surfaces
    // wildly popular but off-topic items. `points` is returned per item so
    // the model can still tell which relevant results are most upvoted.
    const results = await hnIndex.query({
      filter,
      // No `select`: return the full stored hash so we also get url/id,
      // which live in the hash but aren't part of the indexed schema.
      limit,
    });

    return {
      count: results.length,
      items: results.map((r) => {
        const d = r.data as Record<string, unknown>;
        const id = r.key.replace(/^hn:/, "");
        const text = typeof d.text === "string" ? d.text : undefined;
        return {
          id,
          relevance: r.score,
          title: d.title,
          by: d.by,
          type: d.type,
          points: d.score,
          comments: d.ndesc,
          time: d.time,
          url: typeof d.url === "string" ? d.url : `https://news.ycombinator.com/item?id=${id}`,
          snippet: text && text.length > 500 ? `${text.slice(0, 500)}…` : text,
        };
      }),
    };
  },
});
