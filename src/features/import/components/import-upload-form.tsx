"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_IMPORT_BYTES } from "@/features/import/clean";

const GENERIC_ERROR = "Something went wrong. Try again.";
const EXCEL_EXTENSION = /\.(xlsx|xls)$/i;

/** Fast feedback only, with the same wording as the route; the route re-checks by file content. */
function precheck(file: File): string | null {
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_IMPORT_BYTES) return "The file is larger than 4 MB. Split it and import it in parts.";
  if (!EXCEL_EXTENSION.test(file.name)) return "Only Excel files (.xlsx or .xls) are accepted.";
  return null;
}

/** Reads `{ batchId }` / `{ error }` from the parse route; a non-JSON body (proxy error page, 413 from the platform) yields `null`. */
async function readBody(response: Response): Promise<{ batchId?: unknown; error?: unknown } | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null ? body : null;
  } catch {
    return null;
  }
}

export function ImportUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [navigating, startNavigation] = useTransition();
  // Stays true through the route change so a second click cannot upload the file twice.
  const pending = uploading || navigating;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || pending) return;
    const problem = precheck(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/import/parse", { method: "POST", body: formData });
      const body = await readBody(response);
      if (response.status === 201 && typeof body?.batchId === "string") {
        const batchId = body.batchId;
        startNavigation(() => router.push(`/import/${batchId}`));
      } else {
        setError(typeof body?.error === "string" && body.error ? body.error : GENERIC_ERROR);
      }
    } catch {
      setError(GENERIC_ERROR);
    }
    setUploading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3" noValidate>
      <Field>
        <FieldLabel htmlFor="import-file">Excel file</FieldLabel>
        <Input
          id="import-file"
          name="file"
          type="file"
          accept=".xlsx,.xls"
          disabled={pending}
          aria-describedby="import-file-hint"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        <FieldDescription id="import-file-hint" className="text-caption">
          Up to 4 MB and 2000 rows. The header row needs an Email column and a Course column.
        </FieldDescription>
      </Field>
      {file && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-caption">
          <FileSpreadsheet aria-hidden className="size-4 text-primary shrink-0" />
          <span className="font-medium truncate">{file.name}</span>
          <span className="text-muted-foreground shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <Button
          type="submit"
          className="min-h-[44px] sm:min-h-[36px]"
          disabled={pending || !file}
        >
          {pending ? "Reading the file…" : "Upload and check"}
        </Button>
      </div>
    </form>
  );
}
