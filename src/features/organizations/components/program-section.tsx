"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { deleteProgram } from "@/features/organizations/actions";
import { ProgramDialog } from "@/features/organizations/components/program-dialog";

type Program = { id: string; name: string; dcId: string; dcName: string };
type DcOption = { id: string; name: string };

export function ProgramSection({ programs, dcs }: { programs: Program[]; dcs: DcOption[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [confirming, setConfirming] = useState<Program | null>(null);
  const [pending, setPending] = useState(false);

  const columns: ColumnDef<Program, unknown>[] = [
    { accessorKey: "name", header: "Tên chương trình" },
    { accessorKey: "dcName", header: "Trung tâm" },
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
    const result = await deleteProgram({ id: confirming.id });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      setConfirming(null);
      return;
    }
    toast.success(`Đã xóa chương trình ${confirming.name}`);
    setConfirming(null);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">Chương trình</h2>
        <Button
          size="sm"
          disabled={dcs.length === 0}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden className="size-4" />
          Thêm chương trình
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={programs}
        getRowId={(row) => row.id}
        empty={
          <EmptyState
            title="Chưa có chương trình nào"
            description={dcs.length === 0 ? "Thêm trung tâm trước." : "Thêm chương trình đầu tiên."}
          />
        }
      />
      <ProgramDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} dcs={dcs} />
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Xóa chương trình ${confirming?.name}?`}
        description="Chỉ xóa được khi chương trình chưa có team nào."
        confirmLabel="Xóa chương trình"
        pendingLabel="Đang xóa…"
        pending={pending}
        onConfirm={handleDelete}
      />
    </section>
  );
}
