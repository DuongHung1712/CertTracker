import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { ExportLinks } from "@/features/export/components/export-links";
import { ColumnsGuide } from "@/features/import/components/columns-guide";
import { BatchHistory } from "@/features/import/components/batch-history";
import { ImportUploadForm } from "@/features/import/components/import-upload-form";
import { listImportBatches } from "@/features/import/queries";

export default async function ImportPage() {
  const user = await getCurrentUser();
  // UX only: RLS on the import tables is the real guard.
  if (user?.role !== "admin") redirect("/dashboard");
  const batches = await settle(listImportBatches());

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader
        title="Import / Export"
        description="Import certificates and learning from Excel, or export CSV or Excel."
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Import certificates from Excel</h2>
        <ImportUploadForm />
        <ColumnsGuide />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Export data</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportLinks />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">Import history</h2>
        {batches.ok ? <BatchHistory batches={batches.data} /> : <SectionError title="Import history" />}
      </section>
    </div>
  );
}
