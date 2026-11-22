"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import type { CertificateSuggestion } from "@/features/records/ai-read";
import { EVIDENCE_ACCEPT, MAX_EVIDENCE_BYTES } from "@/lib/storage/evidence";

const NETWORK_ERROR = "The AI could not be reached. Fill in the form by hand, or try again.";

type Status = { kind: "idle" } | { kind: "reading" } | { kind: "done"; filled: number } | { kind: "failed"; message: string };

/**
 * The first thing in the Add sheet when the AI reader is on: it says what the AI does, takes the certificate file and
 * reads it as soon as it is chosen. It never saves anything; the sheet applies the suggestion and the member saves.
 */
export function AiFileCard({
  file,
  onFileChange,
  onSuggestion,
  onReadingChange,
  onReject,
  missing,
  fileError,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onSuggestion: (suggestion: CertificateSuggestion) => void;
  onReadingChange: (reading: boolean) => void;
  onReject: (message: string) => void;
  /** Empty required fields; listed after a read so the member knows what is left. */
  missing: { label: string; fieldId: string }[];
  fileError: string | null;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  /** Each read gets a number; an answer whose number is no longer current belongs to a file the member has replaced. */
  const tokenRef = useRef(0);
  const readingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    tokenRef.current += 1;
    abortRef.current?.abort();
    if (readingRef.current) {
      readingRef.current = false;
      onReadingChange(false);
    }
  }

  async function read(chosen: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const token = ++tokenRef.current;
    readingRef.current = true;
    setStatus({ kind: "reading" });
    onReadingChange(true);
    try {
      const body = new FormData();
      body.set("file", chosen);
      const response = await fetch("/api/records/ai-read", { method: "POST", body, signal: controller.signal });
      const answer = (await response.json().catch(() => null)) as { suggestion?: CertificateSuggestion; error?: string } | null;
      if (token !== tokenRef.current) return;
      if (response.ok && answer?.suggestion) {
        onSuggestion(answer.suggestion);
        setStatus({ kind: "done", filled: answer.suggestion.aiFields.length });
      } else {
        setStatus({ kind: "failed", message: answer?.error ?? NETWORK_ERROR });
      }
    } catch {
      if (token === tokenRef.current) setStatus({ kind: "failed", message: NETWORK_ERROR });
    } finally {
      if (token === tokenRef.current) {
        readingRef.current = false;
        onReadingChange(false);
      }
    }
  }

  function handleChange(next: File | null) {
    onFileChange(next);
    if (next) void read(next);
    else {
      stop();
      setStatus({ kind: "idle" });
    }
  }

  // The sheet can clear the file itself (closing, switching to another record): a read still running for it must not fill the form.
  useEffect(() => {
    if (!file && readingRef.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stop` only touches refs and the stable callback
  }, [file]);
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown: Status = file ? status : { kind: "idle" };

  return (
    <section aria-labelledby="ai-file-card-title" className="flex flex-col gap-3 rounded-lg border border-input bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id="ai-file-card-title" className="flex items-center gap-2 text-body font-medium text-foreground">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Have your certificate file?
        </h3>
        <p className="text-caption text-muted-foreground">Upload it and AI fills in the form for you.</p>
      </div>
      <FileDropzone id="record-ai-file" file={file} onChange={handleChange} accept={EVIDENCE_ACCEPT} maxBytes={MAX_EVIDENCE_BYTES} onReject={onReject} />
      {fileError && (
        <p role="alert" className="text-caption text-destructive">
          {fileError}
        </p>
      )}
      <div role="status" aria-live="polite" className="flex flex-col gap-2 text-body">
        {shown.kind === "reading" && <p className="text-muted-foreground">Reading your file…</p>}
        {shown.kind === "done" && (
          <p>
            {shown.filled > 0
              ? `AI filled ${shown.filled} ${shown.filled === 1 ? "field" : "fields"}. Check them before saving.`
              : "AI could not fill any field. Fill in the form below."}
          </p>
        )}
        {shown.kind === "failed" && <p className="text-destructive">{shown.message}</p>}
        {(shown.kind === "done" || shown.kind === "failed") && file && (
          <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => void read(file)}>
            Read again
          </Button>
        )}
        {shown.kind === "done" && missing.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">Still needed:</span>
            {missing.map((item) => (
              <Button key={item.fieldId} type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => document.getElementById(item.fieldId)?.focus()}>
                {item.label}
              </Button>
            ))}
          </p>
        )}
      </div>
      <p className="text-caption text-muted-foreground">
        The file is sent to an AI service (DeepSeek) to read it. You check everything before saving. No file? Skip this and fill in the form below.
      </p>
    </section>
  );
}
