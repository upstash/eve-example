import { Redis } from "@upstash/redis";

/**
 * Untyped reference to the `hn` HackerNews search index in Upstash Redis.
 *
 * It's a HASH index (key prefix `hn:`) over ~44M HackerNews items. We keep it
 * untyped on purpose: the query / count / aggregate tools forward raw,
 * model-authored option objects straight to the SDK, so we don't want
 * compile-time schema constraints on those inputs. Read-only.
 */
export const hnIndex = Redis.fromEnv().search.index({ name: "hn" });

/** Name of the skill that documents how to author queries for this index. */
export const SEARCH_SKILL = "upstash-redis-search";

/**
 * Human-readable schema of the `hn` index, embedded into each tool's
 * description so the model knows which fields it can filter / sort / aggregate.
 */
export const HN_SCHEMA_DOC = `Index "hn" — HackerNews items (~44M docs, key prefix "hn:"). Fields:
- title  TEXT     full-text searchable item title
- text   TEXT     full-text body / comment text (often empty on link stories)
- by     KEYWORD  author username (exact match)
- type   KEYWORD  one of: story | comment | job | poll | pollopt
- score  F64      HackerNews points / upvotes (numeric, sortable)
- ndesc  F64      number of descendants (≈ comment count)
- parent F64      parent item id (0 for top-level stories)
- time   DATE     creation time (ISO timestamp)
The stored hash also carries non-indexed "id" and "url" fields, returned in query results.`;
