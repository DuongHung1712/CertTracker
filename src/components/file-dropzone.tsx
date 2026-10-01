"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
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
}: {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Comma-separated MIME types, e.g. `EVIDENCE_ACCEPT`. */
  accept: string;
  maxBytes: number;
  onReject: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    const allowed = accept.split(",").map((type) => type.trim());
    if (candidate.size === 0) return onReject("Tệp rỗng.");
    if (candidate.size > maxBytes) return onReject("Tệp lớn hơn 4 MB. Nén hoặc chụp lại rồi thử lại.");
    if (!allowed.includes(candidate.type)) return onReject("Chỉ nhận tệp PDF, JPG, PNG hoặc WebP.");
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
        <>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-caption text-muted-foreground">
              {formatNumber(Math.ceil(file.size / 1024))} KB
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
            Bỏ tệp
          </Button>
        </>
      ) : (
        <label htmlFor={id} className="flex-1 cursor-pointer text-muted-foreground">
          Kéo thả hoặc chọn tệp PDF, JPG, PNG, WebP (tối đa 4 MB)
        </label>
      )}
    </div>
  );
}
