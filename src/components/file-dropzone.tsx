"use client";

import { useRef, useState } from "react";
import { CloudUpload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { EVIDENCE_EMPTY_MESSAGE, EVIDENCE_TOO_LARGE_MESSAGE, EVIDENCE_WRONG_TYPE_MESSAGE } from "@/lib/storage/evidence";
import { cn } from "@/lib/utils";

/**
 * Single-file drop area with a real (visually hidden) file input, so keyboard and screen-reader
 * users get the native picker. Checks are fast feedback only — the server re-validates by magic bytes.
 */
export function FileDropzone({
  id,
  file,
  onChange,
  accept,
  maxBytes,
  onReject,
  disabled = false,
  hint = "Drop a file here or choose one: PDF, JPG, PNG or WebP, up to 4 MB",
  wrongTypeMessage = EVIDENCE_WRONG_TYPE_MESSAGE,
}: {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Comma-separated MIME types (e.g. `EVIDENCE_ACCEPT`) and/or file extensions (e.g. `.xlsx`). */
  accept: string;
  maxBytes: number;
  onReject: (message: string) => void;
  disabled?: boolean;
  hint?: string;
  wrongTypeMessage?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    const allowed = accept.split(",").map((type) => type.trim());
    if (candidate.size === 0) return onReject(EVIDENCE_EMPTY_MESSAGE);
    if (candidate.size > maxBytes) return onReject(EVIDENCE_TOO_LARGE_MESSAGE);
    const lowerName = candidate.name.toLowerCase();
    if (!allowed.some((type) => (type.startsWith(".") ? lowerName.endsWith(type) : type === candidate.type))) return onReject(wrongTypeMessage);
    onChange(candidate);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }

  return (
    <div
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        pick(event.dataTransfer.files[0]);
      }}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-dashed border-input px-3 py-4 text-body focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        dragging && "bg-accent",
        disabled && "opacity-50",
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          // The chosen File lives in the parent's state; emptying the input means re-picking the
          // same file (after a removal, a reset or a rejection) still fires `change`.
          event.target.value = "";
        }}
      />
      {file ? (
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="truncate text-body font-medium text-foreground">{file.name}</span>
            <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
              ({formatNumber(Math.ceil(file.size / 1024))} KB)
            </span>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
            Remove file
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <CloudUpload aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-body">{hint}</span>
        </label>
      )}
    </div>
  );
}
