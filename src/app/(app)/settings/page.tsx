import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { NotificationRuns } from "@/features/notifications/components/notification-runs";
import { listNotificationRuns } from "@/features/notifications/queries";
import { emailSetupStatus } from "@/features/notifications/runs";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  // UX only — the notification_log policy returns nothing to non-admins.
  if (user && user.role !== "admin") redirect("/dashboard");
  const runs = await listNotificationRuns();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cài đặt" description="Lịch sử gửi email tự động và trạng thái cấu hình." />
      <NotificationRuns runs={runs} checks={emailSetupStatus(process.env)} />
    </div>
  );
}
