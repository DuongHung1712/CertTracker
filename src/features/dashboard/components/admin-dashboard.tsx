import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import type { AdminDashboardData } from "@/features/dashboard/load";

export function AdminDashboard({
  data,
}: {
  role?: string;
  data: AdminDashboardData;
}) {
  return (
    <AdminDashboardView
      greeting={data.greeting}
      subtitle={data.subtitle}
      profile={data.profile}
      data={data}
    />
  );
}
