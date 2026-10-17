import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { DataQualityTable } from "@/features/data-quality/components/data-quality-table";
import { listDataQualityIssues } from "@/features/data-quality/queries";

export default async function DataQualityPage() {
  const user = await getCurrentUser();
  // UX only — the view and RLS would show a Member just their own rows; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const issues = await listDataQualityIssues();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Chất lượng dữ liệu"
        description="Những bản ghi cần được rà soát và sửa. Constraint trong DB đã chặn dữ liệu sai; đây là phần còn lại."
      />
      <DataQualityTable issues={issues} />
    </div>
  );
}
