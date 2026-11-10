"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/file-dropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MAX_IMPORT_BYTES } from "@/features/import/clean";
import { importMembers, previewMemberImport } from "@/features/members/import-actions";
import { ImportPreviewTable } from "@/features/members/components/import-preview-table";

type Preview = Extract<Awaited<ReturnType<typeof previewMemberImport>>, { ok: true }>["data"];

export function ImportMembersDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
  }

  function choose(next: File | null) {
    reset();
    if (!next) return;
    setFile(next);
    const formData = new FormData();
    formData.set("file", next);
    startTransition(async () => {
      const result = await previewMemberImport(formData);
      if (result.ok) setPreview(result.data);
      else setError(result.error);
    });
  }

  function confirm() {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await importMembers(formData);
      if (!result.ok) return setError(result.error);
      toast.success(`Imported ${result.data.created} members.`);
      setOpen(false);
      reset();
    });
  }

  const create = preview?.counts.create ?? 0;
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button variant="outline" />}>Import members</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import members</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with the columns Full name, Email, Team and Career role. Members are created without an invitation.{" "}
            <a href="/templates/members-import.csv" download className="inline-flex items-center gap-1 text-primary underline">
              <Download aria-hidden className="size-4" />
              Download template
            </a>
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <>
            <p className="text-body">{`${preview.counts.create} to create, ${preview.counts.skip} skipped, ${preview.counts.error} with errors`}</p>
            <ImportPreviewTable rows={preview.rows} />
          </>
        ) : (
          <FileDropzone
            id="members-import-file"
            file={file}
            onChange={choose}
            accept=".xlsx,.csv"
            maxBytes={MAX_IMPORT_BYTES}
            onReject={setError}
            disabled={pending}
            hint="Drop a file here or choose one: Excel (.xlsx) or CSV, up to 4 MB"
            wrongTypeMessage="Only .xlsx or .csv files are accepted."
          />
        )}
        {error && <p role="alert" className="text-body text-destructive">{error}</p>}
        <DialogFooter>
          {(preview || error) && <Button variant="outline" disabled={pending} onClick={reset}>Choose another file</Button>}
          {preview && <Button disabled={pending || create === 0} onClick={confirm}>{`Import ${create} members`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
