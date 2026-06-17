# Ask HackerNews

A natural-language search and analytics agent over **~44M HackerNews items**,
built with [Vercel Eve](https://vercel.com/eve) — the framework for building
agents ("like Next.js for web apps, but for agents") — and
[Upstash Redis Search](https://upstash.com/docs/redis/search/introduction).
The data comes from the same source as [HackerNews Trends](https://hackernewstrends.com/).

Ask things like *"top stories about Rust"*, *"what do people say about remote
work?"*, or *"average score of stories vs jobs"* and the agent grounds its
answer in real HackerNews data.

> Live example repo: [`upstash/eve-example`](https://github.com/upstash/eve-example)

## How it works

[Eve](https://eve.dev/docs) is a filesystem-first framework for durable agents:
you write capabilities under `agent/`, and Eve runs the model loop, persists
sessions, and serves the agent over HTTP. This project pairs it with a Next.js
web chat via [`withEve`](https://eve.dev/docs/guides/frontend/nextjs).

The agent has three thin tools that forward a **raw Upstash Redis Search options
object** straight to the Upstash Redis SDK, so the model has the full power of the query
language:

| Tool        | Backed by            | Use                                            |
| ----------- | -------------------- | ---------------------------------------------- |
| `query`     | `index.query()`      | Search / filter / sort / paginate documents.   |
| `count`     | `index.count()`      | Count documents matching a filter.             |
| `aggregate` | `index.aggregate()`  | Analytics: averages, sums, grouping, histograms. |

The query syntax and the index schema live in the agent's
[system prompt](agent/instructions.md), so the model can author queries directly.

### The `hn` index

A hash index (prefix `hn:`) over HackerNews stories, comments, Ask/Show HN, jobs
and polls:

| Field            | Type            | Notes                              |
| ---------------- | --------------- | ---------------------------------- |
| `title`, `text`  | TEXT            | Full-text search.                  |
| `by`, `type`     | KEYWORD         | Author, item type.                 |
| `score`, `ndesc`, `parent` | F64 (FAST) | Points, comment count, parent id. |
| `time`           | DATE (FAST)     | Creation time.                     |

## Project layout

```
agent/
  agent.ts                 # model + runtime config
  instructions.md          # system prompt + Upstash Redis Search query reference
  channels/eve.ts          # HTTP channel (auth)
  lib/hn-index.ts          # shared Upstash Redis client + `hn` index
  tools/{query,count,aggregate}.ts
app/                       # Next.js chat UI (useEveAgent)
components/                # UI primitives
next.config.ts             # withEve(...)
```

## Setup

Requires Node 24+.

```bash
npm install
```

Set credentials in `.env` (read by `Redis.fromEnv()`):

```
OPENAI_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Create an Upstash Redis database at [console.upstash.com](https://console.upstash.com),
and an OpenAI key at [platform.openai.com](https://platform.openai.com). To build
your own index, see the [Upstash Redis Search docs](https://upstash.com/docs/redis/search/introduction).

## Run

```bash
npm run dev      # Next.js + Eve dev server → http://localhost:3000
```

Or drive just the agent over HTTP:

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What are the top HackerNews stories about Rust?"}'
```

## Deploy

Deploys to [Vercel](https://vercel.com) as a single project (Next.js app +
Eve runtime). Make sure your Vercel CLI is up to date, then `vercel deploy`.
Before going to production, review
[Auth & route protection](https://eve.dev/docs/guides/auth-and-route-protection)
— this demo uses `none()` so the agent is publicly callable.

## Links

- [Vercel Eve](https://vercel.com/eve) · [Eve docs](https://eve.dev/docs)
- [Upstash Redis Search](https://upstash.com/docs/redis/search/introduction) · [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis)
- [HackerNews Trends](https://hackernewstrends.com/)
