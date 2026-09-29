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
    { accessorKey: "name", header: "Tên loại chứng chỉ" },
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
            Sửa
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(row.original)}>
            Xóa
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
    toast.success(`Đã xóa loại chứng chỉ ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Loại chứng chỉ</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm loại chứng chỉ
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={certTypes}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có loại chứng chỉ nào" />}
      />
      <CertTypeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa loại chứng chỉ ${confirming?.name}?`}
        description="Chỉ xóa được khi không có khóa học nào dùng loại này."
        confirmLabel="Xóa loại chứng chỉ"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
