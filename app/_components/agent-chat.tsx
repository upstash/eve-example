"use client";

import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { AgentMessage, messageHasVisibleContent } from "./agent-message";

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

// Laid out 1-2-2 across rows; chips hug their text and stay on a single line.
const SUGGESTION_ROWS = [
  ["Top stories about Rust"],
  ["Most upvoted Show HN launches", "Average score of stories vs jobs"],
  ["What do people say about remote work?", "How many stories mention AI in the title?"],
];

const SPRING = { type: "spring", stiffness: 320, damping: 32 } as const;

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  // Show a spinner while waiting for the agent's first visible output (no text
  // or tool call has streamed in yet).
  const lastMessage = agent.data.messages.at(-1);
  const awaitingResponse =
    isBusy &&
    (lastMessage === undefined ||
      lastMessage.role !== "assistant" ||
      !messageHasVisibleContent(lastMessage));

  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    await agent.send({ message: trimmed });
  };

  const handleSubmit = (message: PromptInputMessage) => submitText(message.text);

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Ask anything about HackerNews…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Header canReset={!isEmpty} onReset={agent.reset} status={agent.status} />

      <AnimatePresence>
        {agent.error ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="mx-auto w-full max-w-4xl shrink-0 overflow-hidden px-4 sm:px-6"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Request failed</p>
                <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isEmpty && (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-4 py-6 sm:px-6">
            {agent.data.messages.map((message, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="w-full"
                initial={message.role === "user" ? false : { opacity: 0, y: 12 }}
                key={message.id}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <AgentMessage
                  canRespond={!isBusy}
                  isStreaming={
                    agent.status === "streaming" && index === agent.data.messages.length - 1
                  }
                  message={message}
                  onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                />
              </motion.div>
            ))}
            {awaitingResponse ? (
              <motion.div animate={{ opacity: 1 }} className="w-full" initial={{ opacity: 0 }}>
                <div className="flex w-fit items-center justify-center rounded-2xl bg-muted/50 px-4 py-3">
                  <Spinner className="size-4 text-muted-foreground" />
                </div>
              </motion.div>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {/* The composer is a single persistent element: centered on the landing
          page, pinned to the bottom while chatting. `layout` lives on the
          composer itself so it animates from its real position (not the full
          flex-1 column, whose box starts at the top of the screen). */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 sm:px-6",
          isEmpty ? "flex-1 justify-center pb-[8vh]" : "shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2">
            <span className="mb-1 text-center text-muted-foreground text-xs uppercase tracking-wide">
              Try asking
            </span>
            {SUGGESTION_ROWS.map((row) => (
              <div className="flex justify-center gap-2" key={row.join("|")}>
                {row.map((suggestion) => (
                  <button
                    className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border bg-background px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                    key={suggestion}
                    onClick={() => void submitText(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <motion.div
          className={cn("w-full", isEmpty && "max-w-xl")}
          layout
          transition={SPRING}
        >
          {composer}
        </motion.div>
      </div>
    </main>
  );
}

function Header({
  canReset,
  onReset,
  status,
}: {
  readonly canReset: boolean;
  readonly onReset: () => void;
  readonly status: AgentStatus;
}) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          aria-label="Start a new chat"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-[#ff6600] font-bold text-sm text-white transition-opacity hover:opacity-80 disabled:pointer-events-none"
          disabled={!canReset}
          onClick={onReset}
          type="button"
        >
          Y
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              className="cursor-pointer font-semibold text-sm leading-tight transition-colors hover:text-foreground/70 disabled:pointer-events-none"
              disabled={!canReset}
              onClick={onReset}
              type="button"
            >
              Ask HackerNews
            </button>
            <StatusDot status={status} />
          </div>
          <p className="text-muted-foreground text-xs leading-snug">
            Search ~44M HackerNews items with the same data as{" "}
            <a className="text-foreground/80 underline-offset-2 hover:underline" href="https://hackernewstrends.com/" rel="noreferrer" target="_blank">
              HackerNews Trends
            </a>
            , powered by{" "}
            <a className="text-foreground/80 underline-offset-2 hover:underline" href="https://upstash.com/docs/redis/search/introduction" rel="noreferrer" target="_blank">
              Upstash Redis Search
            </a>{" "}
            on{" "}
            <a className="text-foreground/80 underline-offset-2 hover:underline" href="https://vercel.com/eve" rel="noreferrer" target="_blank">
              Vercel Eve
            </a>
            .
          </p>
        </div>
        <a
          aria-label="View source on GitHub"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="https://github.com/upstash/eve-example"
          rel="noreferrer"
          target="_blank"
        >
          <GithubMark />
        </a>
      </div>
    </header>
  );
}

function GithubMark() {
  return (
    <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.5 11.5 0 0 1 6 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .31.21.68.83.56C20.56 21.88 24 17.48 24 12.29 24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1.5 shrink-0">
      {isLive ? (
        <span
          className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", tone)}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1.5 rounded-full transition-colors", tone)} />
    </span>
  );
}
