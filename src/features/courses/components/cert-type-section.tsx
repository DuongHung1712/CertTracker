"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteCertType } from "@/features/courses/actions";
import { CertTypeDialog } from "@/features/courses/components/cert-type-dialog";

type CertType = { id: string; name: string };

export function CertTypeSection({ certTypes }: { certTypes: CertType[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CertType | null>(null);
  const [confirming, setConfirming] = useState<CertType | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<CertType, unknown>[] = [
    { accessorKey: "name", header: "Certificate type name" },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(row.original);
              setDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteCertType({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Deleted certificate type ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Certificate types</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Add certificate type
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={certTypes}
        getRowId={(row) => row.id}
        empty={<EmptyState title="No certificate types yet" />}
      />
      <CertTypeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Delete certificate type ${confirming?.name}?`}
        description="A certificate type can only be deleted when no course uses it."
        confirmLabel="Delete certificate type"
        pendingLabel="Deleting…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
