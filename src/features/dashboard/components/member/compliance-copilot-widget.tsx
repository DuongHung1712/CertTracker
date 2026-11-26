"use client";

import { useState } from "react";
import { Bot, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ComplianceCopilotWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {open ? (
        <section
          aria-label="Ask about certificates (Coming soon)"
          className="mb-3 flex w-[calc(100vw-3rem)] max-w-80 flex-col rounded-xl border border-border bg-card shadow-xl sm:max-w-none sm:w-96 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30 rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Bot className="size-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-body font-semibold text-foreground">Ask about certificates</h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-caption rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground border">
                Coming soon
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close chat"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  }
                />
                <TooltipContent side="top">Close chat</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex flex-col gap-3 p-4">
            <div className="rounded-lg bg-muted/50 p-3 text-caption text-muted-foreground leading-relaxed">
              Ask questions about exam refunds, renewals and approved courses. Not available yet.
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-muted-foreground">Suggested topics:</span>
              <div className="flex flex-wrap gap-1">
                <span className="text-caption rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                  Exam refund policy
                </span>
                <span className="text-caption rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                  AWS certification path
                </span>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="border-t p-3 bg-card rounded-b-xl">
            <div className="flex items-center gap-2">
              <Input
                disabled
                aria-disabled="true"
                aria-label="Your question"
                placeholder="Type your question"
                className="cursor-not-allowed bg-muted/40 text-caption"
              />
              <Button
                disabled
                aria-disabled="true"
                size="sm"
                aria-label="Send question"
                className="size-9 shrink-0 p-0 cursor-not-allowed opacity-50"
              >
                <Send className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Floating Toggle Button */}
      <Button
        size="lg"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="gap-2 rounded-lg shadow-lg h-12 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95"
      >
        <MessageSquare className="size-5" aria-hidden="true" />
        <span className="text-body font-medium">Ask about certificates</span>
      </Button>
    </div>
  );
}
