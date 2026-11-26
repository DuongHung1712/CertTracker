import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { AiReaderSettings } from "@/features/ai/components/ai-reader-settings";
import { getAiReaderSettings } from "@/features/ai/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { CareerRolesSection } from "@/features/career/components/career-roles-section";
import { listCareerRoles } from "@/features/career/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { NotificationRuns } from "@/features/notifications/components/notification-runs";
import { listNotificationRuns } from "@/features/notifications/queries";
import { emailSetupStatus } from "@/features/notifications/runs";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  // UX only — the notification_log policy returns nothing to non-admins.
  if (user?.role !== "admin") redirect("/dashboard");
  const [runs, careerRoles, aiSettings] = await Promise.all([
    settle(listNotificationRuns()),
    settle(listCareerRoles()),
    settle(getAiReaderSettings()),
  ]);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Settings" description="Career roles, the AI certificate reader, plus the history and setup status of automatic emails." />
      {careerRoles.ok ? <CareerRolesSection roles={careerRoles.data} /> : <SectionError title="Career roles" />}
      {!aiSettings.ok ? (
        <SectionError title="AI certificate reader" />
      ) : (
        aiSettings.data && <AiReaderSettings settings={aiSettings.data} />
      )}
      {runs.ok ? (
        <NotificationRuns runs={runs.data} checks={emailSetupStatus(process.env)} />
      ) : (
        <SectionError title="Email history" />
      )}
    </div>
  );
}
