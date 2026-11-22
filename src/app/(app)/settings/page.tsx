import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { AiReaderSettings } from "@/features/ai/components/ai-reader-settings";
import { getAiReaderSettings } from "@/features/ai/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { CareerRolesSection } from "@/features/career/components/career-roles-section";
import { listCareerRoles } from "@/features/career/queries";
import { NotificationRuns } from "@/features/notifications/components/notification-runs";
import { listNotificationRuns } from "@/features/notifications/queries";
import { emailSetupStatus } from "@/features/notifications/runs";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  // UX only — the notification_log policy returns nothing to non-admins.
  if (user?.role !== "admin") redirect("/dashboard");
  const [runs, careerRoles, aiSettings] = await Promise.all([listNotificationRuns(), listCareerRoles(), getAiReaderSettings()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Career roles, the AI certificate reader, plus the history and setup status of automatic emails." />
      <CareerRolesSection roles={careerRoles} />
      {aiSettings && <AiReaderSettings settings={aiSettings} />}
      <NotificationRuns runs={runs} checks={emailSetupStatus(process.env)} />
    </div>
  );
}
