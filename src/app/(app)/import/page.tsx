import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { ExportLinks } from "@/features/export/components/export-links";
import { BatchHistory } from "@/features/import/components/batch-history";
import { ImportUploadForm } from "@/features/import/components/import-upload-form";
import { listImportBatches } from "@/features/import/queries";

export default async function ImportPage() {
  const user = await getCurrentUser();
  // UX only: RLS on the import tables is the real guard.
  if (user?.role !== "admin") redirect("/dashboard");
  const batches = await listImportBatches();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Import / Export" description="Nhập dữ liệu từ Excel cũ, xuất CSV/Excel." />
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Nhập từ Excel</h2>
        <ImportUploadForm />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Xuất dữ liệu</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportLinks />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Lịch sử nhập</h2>
        <BatchHistory batches={batches} />
      </section>
    </div>
  );
}
