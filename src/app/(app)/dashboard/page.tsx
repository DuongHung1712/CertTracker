import { PageHeader } from "@/components/app-shell/page-header";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Tổng quan chứng chỉ của đơn vị." />
      <p className="rounded-lg border bg-card p-6 text-body text-muted-foreground">
        KPI và thống kê sẽ có ở tuần 5.
      </p>
    </div>
  );
}
