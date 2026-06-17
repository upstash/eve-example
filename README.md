# my-agent

An [Eve](https://www.npmjs.com/package/eve) agent that answers questions about
**HackerNews**, grounding its answers (RAG) in an Upstash Redis full-text search
index over ~44M HN items.

Eve is a filesystem-first framework for durable agents: capabilities live under
`agent/`, and Eve runs the model loop, persists sessions, and serves the agent
over HTTP. The framework docs are bundled at `node_modules/eve/docs/`.

## How it works

The agent has one tool, `search_hackernews`, that runs full-text search against
the `hn` index in Upstash Redis and returns the matching items. The model calls
it to ground answers in real HackerNews content instead of relying on its own
recollection.

- **Index:** `hn` — a HASH index (key prefix `hn:`) over HackerNews stories,
  comments, Ask/Show HN, jobs and polls.
- **Indexed fields:** `title`, `text` (full-text) · `by`, `type` (keyword) ·
  `score` (points), `ndesc` (comment count), `parent` (numeric) · `time` (date).
  The stored hash also carries `url` and `id`.
- **Access:** the [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis)
  SDK's `redis.search` API, over HTTP.

## Project layout

```
agent/
  agent.ts                    # runtime config (model)
  instructions.md             # system prompt
  channels/eve.ts             # built-in HTTP channel
  tools/
    search_hackernews.ts      # full-text RAG search over the `hn` index
```

### The `search_hackernews` tool

Relevance-ranked full-text search over the title and body of HN items.

| Input    | Type                                       | Notes                                            |
| -------- | ------------------------------------------ | ------------------------------------------------ |
| `query`  | string (required)                          | Natural-language search terms.                   |
| `type`   | `story` \| `comment` \| `job` \| `poll`    | Optional — restrict to one item type.            |
| `limit`  | number (1–20, default 5)                   | Max items to return.                             |

Each result includes `id`, `relevance`, `title`, `by`, `type`, `points`,
`comments`, `time`, `url` (falls back to the HN discussion link), and a text
`snippet`.

Results are ranked by **text relevance**, not raw points — sorting purely by
points surfaces wildly popular but off-topic items. `points` is returned per
item so the model can still pick the most-upvoted among the relevant results.

## Setup

Requires Node 24+.

```bash
npm install
```

Set the credentials in `.env` (already wired via `Redis.fromEnv()`):

```
OPENAI_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Run

```bash
npm run dev        # local runtime + interactive TUI
```

Or build and serve the production output:

```bash
npm run build
npm start
```

Then exercise the HTTP API:

```bash
# Start a session
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"What are the top HackerNews stories about Rust?"}'

# Stream it (x-eve-session-id comes back in the response headers)
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

## Scripts

- `npm run dev` — local dev runtime + TUI
- `npm run build` — compile the agent into `.eve/` and build the host output
- `npm start` — serve the built output
- `npm run typecheck` — type-check with `tsgo`
