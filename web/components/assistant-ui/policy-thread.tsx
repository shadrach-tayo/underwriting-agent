"use client"

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Copy01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
  type TextMessagePartComponent,
} from "@assistant-ui/react"
import type { FC } from "react"

import { Reasoning } from "@/components/assistant-ui/reasoning"
import { Sources } from "@/components/assistant-ui/sources"
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui"
import { Markdown } from "@/components/markdown"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MarkdownText: TextMessagePartComponent = ({ text }) => (
  <Markdown>{text}</Markdown>
)

export function PolicyThread() {
  const isEmpty = useAuiState((s) => s.thread.messages.length === 0)

  return (
    <ThreadPrimitive.Root className="aui-root flex h-full min-h-0 flex-col bg-background">
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        <div
          className={cn(
            "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4",
            isEmpty && "justify-center"
          )}
        >
          <AuiIf condition={(s) => s.thread.messages.length === 0}>
            <ThreadWelcome />
            <ThreadSuggestions />
          </AuiIf>

          <div className="mb-12 flex flex-col gap-6 empty:hidden">
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>
        </div>

        <ThreadPrimitive.ViewportFooter
          className={cn(
            "sticky bottom-0 mt-auto flex flex-col gap-3 bg-background px-4 pb-4",
            !isEmpty && "pt-2"
          )}
        >
          <ThreadScrollToBottom />
          <ThreadFollowupSuggestions />
          <Composer />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

const ThreadWelcome: FC = () => (
  <div className="mb-6 space-y-2 text-center">
    <h2 className="font-heading text-xl font-semibold tracking-tight">
      Policy chat
    </h2>
    <p className="mx-auto max-w-md text-sm text-muted-foreground">
      Ask a question. The agent retrieves layered policy chunks, then streams a
      grounded answer with sources.
    </p>
  </div>
)

const ThreadSuggestions: FC = () => (
  <div className="mx-auto mb-6 flex w-full max-w-md flex-col gap-2">
    <ThreadPrimitive.Suggestions>
      {() => (
        <SuggestionPrimitive.Trigger
          send
          className="rounded-lg border border-border/70 bg-background px-3 py-2 text-start text-sm transition-colors hover:border-foreground/25 hover:bg-muted/40"
        >
          <SuggestionPrimitive.Title />
        </SuggestionPrimitive.Trigger>
      )}
    </ThreadPrimitive.Suggestions>
  </div>
)

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role)
  if (role === "user") return <UserMessage />
  return <AssistantMessage />
}

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
)

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="space-y-3">
    <div className="text-sm leading-relaxed">
      <MessagePrimitive.Parts
        components={{
          Text: MarkdownText,
          Reasoning,
          Source: Sources,
        }}
      />
    </div>
    <MessageError />
    <AssistantActionBar />
  </MessagePrimitive.Root>
)

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <ErrorPrimitive.Message />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
)

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="flex items-center gap-1 text-muted-foreground"
  >
    <ActionBarPrimitive.Copy asChild>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }))}
        aria-label="Copy answer"
      >
        <AuiIf condition={(s) => s.message.isCopied}>
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        </AuiIf>
        <AuiIf condition={(s) => !s.message.isCopied}>
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
        </AuiIf>
      </button>
    </ActionBarPrimitive.Copy>
  </ActionBarPrimitive.Root>
)

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "outline", size: "icon-sm" }),
        "absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-full disabled:invisible"
      )}
      aria-label="Scroll to bottom"
    >
      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
    </button>
  </ThreadPrimitive.ScrollToBottom>
)

const Composer: FC = () => (
  <ComposerPrimitive.Root className="mx-auto w-full max-w-3xl">
    <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-muted/20 p-2 focus-within:border-foreground/25">
      <ComposerPrimitive.Input
        placeholder="Ask a policy question…"
        className="max-h-40 min-h-10 w-full resize-none bg-transparent px-2.5 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
        rows={1}
        autoFocus
        aria-label="Message input"
      />
      <div className="flex items-center justify-end">
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send
            className={cn(buttonVariants({ size: "icon-sm" }), "rounded-full")}
            aria-label="Send message"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              size="icon-sm"
              className="rounded-full"
              aria-label="Stop generating"
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  </ComposerPrimitive.Root>
)
