---
description: How to author Upstash Redis Search options for the HackerNews `hn` index — filter/operator syntax, query options, counting, and aggregations. Load before using the query, count, or aggregate tools for anything non-trivial.
---

# Authoring Upstash Redis Search queries (the `hn` index)

The `query`, `count`, and `aggregate` tools forward your raw options object
straight to the Upstash Redis Search SDK (`index.query / .count / .aggregate`).
This skill is the syntax reference for building those objects.

## The `hn` index

HackerNews items, ~44M docs, key prefix `hn:`. Fields:

| Field    | Type    | Notes                                                  |
| -------- | ------- | ------------------------------------------------------ |
| `title`  | TEXT    | Full-text item title.                                  |
| `text`   | TEXT    | Full-text body / comment text (empty on link stories). |
| `by`     | KEYWORD | Author username, exact match.                          |
| `type`   | KEYWORD | `story` \| `comment` \| `job` \| `poll` \| `pollopt`.  |
| `score`  | F64     | HN points / upvotes. Numeric, sortable.                |
| `ndesc`  | F64     | Number of descendants (≈ comment count).               |
| `parent` | F64     | Parent item id (`0` for top-level stories).            |
| `time`   | DATE    | Creation time (ISO timestamp, e.g. `2024-01-31`).      |

`id` and `url` are stored on the document and returned in query results, but
they are **not indexed**, so you cannot filter or sort on them.

## Filters

A filter is an object mapping a field to an operator object. With no filter (or
`{}`) everything matches.

### TEXT fields (`title`, `text`)

```jsonc
{ "title": { "$eq": "laptop" } }                         // substring/term match
{ "title": { "$in": ["rust", "zig"] } }                  // any of (OR)
{ "title": { "$fuzzy": { "term": "databse", "distance": 1 } } } // typo tolerance
{ "title": { "$phrase": { "text": "machine learning", "slop": 1 } } } // adjacent words
{ "title": { "$regex": "gpt-.*" } }
{ "title": { "$smart": "self hosted database" } }        // auto fuzzy+phrase+term
```

`$smart` is the best default for natural-language search. Note: TEXT is tokenized
and stemmed (english), so short tokens match loosely (`"rust"` can hit `"trust"`).
For precision prefer multi-word `$smart`/`$phrase`, or match in `title` only.

### KEYWORD fields (`by`, `type`)

```jsonc
{ "type": { "$eq": "story" } }
{ "type": { "$in": ["story", "job"] } }
{ "by": { "$eq": "pg" } }
```

### Numeric fields (`score`, `ndesc`, `parent`)

```jsonc
{ "score": { "$gte": 100 } }
{ "score": { "$gt": 500, "$lte": 1000 } }
{ "parent": { "$eq": 0 } }              // top-level items only
```

### DATE field (`time`)

```jsonc
{ "time": { "$gte": "2024-01-01", "$lt": "2025-01-01" } }
```

### Boolean combinators

```jsonc
{ "$and": [ { "type": { "$eq": "story" } }, { "score": { "$gte": 100 } } ] }
{ "$or":  [ { "title": { "$smart": "rust" } }, { "text": { "$smart": "rust" } } ] }
{ "$must": [ ... ], "$mustNot": [ ... ], "$should": [ ... ] }
```

- `$mustNot` **cannot be used alone** — pair it with `$must` or `$should`.
- `$should` alone behaves like OR (at least one must match).
- Boost a clause's weight with `$boost`: `{ "title": { "$eq": "rust", "$boost": 2 } }`.

## `query` options

Pass any combination of these to the `query` tool:

```jsonc
{
  "filter": { "type": { "$eq": "story" }, },
  "select": { "title": true, "by": true, "score": true }, // omit = full doc, {} = keys only
  "limit": 10,
  "offset": 0,
  "orderBy": { "score": "DESC" },          // mutually exclusive with scoreFunc
  "scoreFunc": { "field": "score", "modifier": "LOG1P" }, // relevance modifier
  "highlight": { "fields": ["title"], "preTag": "<mark>", "postTag": "</mark>" }
}
```

- Default ranking is by text relevance. Use `orderBy` for deterministic sorts.
- `orderBy` and `scoreFunc` cannot be combined.
- Keep `limit` modest and use `select` to avoid pulling huge `text` bodies.

### Common query recipes

```jsonc
// Most-upvoted stories about a topic
{ "filter": { "$and": [ { "title": { "$smart": "kubernetes" } }, { "type": { "$eq": "story" } } ] },
  "select": { "title": true, "score": true, "by": true, "time": true },
  "orderBy": { "score": "DESC" }, "limit": 10 }

// What a specific user posted recently
{ "filter": { "$and": [ { "by": { "$eq": "patio11" } }, { "time": { "$gte": "2024-01-01" } } ] },
  "orderBy": { "time": "DESC" }, "limit": 20 }
```

## `count` options

```jsonc
{ "filter": { "by": { "$eq": "dang" } } }   // omit filter to count all docs
```

Returns `{ count: <number> }`.

## `aggregate` options

```jsonc
{ "filter": { "type": { "$eq": "story" } },   // optional, applied before aggregating
  "aggregations": { "avg_score": { "$avg": { "field": "score" } } } }
```

> **To count how many documents match a filter, use the `count` tool — NOT an
> aggregation.** `$count` here counts non-null values of a *field*, not documents.

### FAST-field rule (read this first)

**Metric** aggregations (`$avg`, `$sum`, `$min`, `$max`, `$count`,
`$stats`, `$extendedStats`, `$percentiles`) only work on **FAST** fields. On the
`hn` index the FAST fields are exactly: **`score`, `ndesc`, `parent`, `time`**.
Pointing a metric at a TEXT/KEYWORD field (`title`, `text`, `by`, `type`) fails
with `requires field '…' to be FAST`. Every metric requires a `field` —
`$count: {}` (no field) is invalid.

`$cardinality` (distinct-value count) and the bucket aggregations below DO work
on KEYWORD fields.

### Metric aggregations

`$avg`, `$sum`, `$min`, `$max`, `$count`, `$stats` (count/min/max/sum/avg),
`$extendedStats` (+variance/stdDeviation), `$percentiles`
(`{ field, percents: [50, 90, 99] }`), `$cardinality` (distinct values). Each
takes `{ field }`. Metric result shape: `{ "<name>": { "value": <number> } }`
(`$stats`/`$extendedStats` return an object of sub-values).

### Bucket aggregations (counts per group — what you usually want)

```jsonc
// Group by a keyword field — each bucket includes its own document count
{ "aggregations": { "by_type": { "$terms": { "field": "type", "size": 10 } } } }

// Numeric ranges
{ "aggregations": { "score_bands": { "$range": { "field": "score",
    "ranges": [ { "to": 10 }, { "from": 10, "to": 100 }, { "from": 100 } ] } } } }

// Fixed-interval histogram
{ "aggregations": { "score_hist": { "$histogram": { "field": "score", "interval": 100 } } } }
```

Bucket results: `{ "<name>": { "buckets": [ { "key": ..., "docCount": N, ... } ] } }`.
Note the field is **`docCount`** (camelCase). Each bucket already carries its
document count — you do NOT need a `$count` inside it.

### Nested aggregations (bucket + metrics)

```jsonc
{ "aggregations": {
    "by_type": { "$terms": { "field": "type" },
      "$aggs": { "avg_score": { "$avg": { "field": "score" } } } } } }
// -> buckets: [ { key:"story", docCount:4672672, avg_score:{ value:13.1 } }, ... ]
```

## Gotchas

- Filtering/sorting only works on **indexed** fields (the table above) — not on
  `id` or `url`.
- TEXT fields are stemmed (`"running"` → `"run"`), so `$regex` matches the stem,
  not the original word.
- Single short tokens match loosely; prefer phrases or `title`-scoped matches
  when you need precision.
- `$mustNot` alone returns nothing; combine it with `$must`/`$should`.
- Counting documents → `count` tool. Metric aggregations only run on the FAST
  fields `score`/`ndesc`/`parent`/`time`. Grouped counts → a bucket aggregation
  whose buckets carry `docCount`.
