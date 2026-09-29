"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteProvider } from "@/features/courses/actions";
import { ProviderDialog } from "@/features/courses/components/provider-dialog";

type Provider = { id: string; name: string };

export function ProviderSection({ providers }: { providers: Provider[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [confirming, setConfirming] = useState<Provider | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Provider, unknown>[] = [
    { accessorKey: "name", header: "Tên nhà cung cấp" },
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
    const result = await deleteProvider({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa nhà cung cấp ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Nhà cung cấp</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm nhà cung cấp
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={providers}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có nhà cung cấp nào" />}
      />
      <ProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa nhà cung cấp ${confirming?.name}?`}
        description="Chỉ xóa được khi không có khóa học nào dùng nhà cung cấp này."
        confirmLabel="Xóa nhà cung cấp"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
