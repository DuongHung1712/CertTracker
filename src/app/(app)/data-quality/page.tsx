import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { DataQualityTable, type DataQualityFilter } from "@/features/data-quality/components/data-quality-table";
import { listDataQualityIssues } from "@/features/data-quality/queries";
import { ISSUE_TYPES, type IssueType } from "@/features/data-quality/schema";

function parseInitialFilter(raw: string | string[] | undefined): DataQualityFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "proposals") return "proposals";
  return (ISSUE_TYPES as readonly string[]).includes(value ?? "") ? (value as IssueType) : null;
}

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  const user = await getCurrentUser();
  // UX only — the view and RLS would show a Member just their own rows; /me is their screen.
  if (user?.role === "member") redirect("/me");
  const issues = await listDataQualityIssues();
  const initialFilter = parseInitialFilter(type);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Data quality"
        description="Certificates, members and catalogue entries that need a check or a fix."
      />
      <DataQualityTable key={initialFilter ?? "all"} issues={issues} initialFilter={initialFilter} />
    </div>
  );
}
