"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteDc } from "@/features/organizations/actions";
import { DcDialog } from "@/features/organizations/components/dc-dialog";

type Dc = { id: string; name: string };

const COLUMNS: ColumnDef<Dc, unknown>[] = [{ accessorKey: "name", header: "Tên trung tâm" }];

export function DcSection({ dcs, canManage }: { dcs: Dc[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dc | null>(null);
  const [confirming, setConfirming] = useState<Dc | null>(null);
  const [pending, setPending] = useState(false);

  const columnsWithActions: ColumnDef<Dc, unknown>[] = [
    ...COLUMNS,
    ...(canManage
      ? ([
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
        ] satisfies ColumnDef<Dc, unknown>[])
      : []),
  ];

  async function handleDelete() {
    if (!confirming) return;
    setPending(true);
    const result = await deleteDc({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa trung tâm ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Trung tâm (DC)</h2>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden className="size-4" />
            Thêm trung tâm
          </Button>
        )}
      </div>
      <DataTable
        columns={columnsWithActions}
        data={dcs}
        getRowId={(row) => row.id}
        empty={<EmptyState title="Chưa có trung tâm nào" description="Thêm trung tâm đầu tiên để bắt đầu." />}
      />
      {canManage && (
        <>
          <DcDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
          <ConfirmDialog
            open={!!confirming}
            onOpenChange={(open) => !open && setConfirming(null)}
            title={`Xóa trung tâm ${confirming?.name}?`}
            description="Chỉ xóa được khi trung tâm chưa có chương trình nào."
            confirmLabel="Xóa trung tâm"
            pendingLabel="Đang xóa…"
            pending={pending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </section>
  );
}
