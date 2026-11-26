import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { getCurrentUser } from "@/features/auth/queries";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { CareerCard } from "@/features/career/components/career-card";
import { getMemberCareer } from "@/features/career/queries";
import { SectionError } from "@/features/dashboard/components/section";
import { settle } from "@/features/dashboard/settle";
import { AccountCard } from "@/features/profile/components/account-card";
import { ScopeCard } from "@/features/profile/components/scope-card";
import { getMyProfile } from "@/features/profile/queries";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, career] = await Promise.all([
    getMyProfile(user),
    user.memberId ? settle(getMemberCareer(user.memberId)) : null,
  ]);

  const parts = ["account", user.role === "manager" ? "scope" : null, career ? "career" : null].filter(
    (part): part is string => part !== null,
  );
  const description =
    parts.length === 1
      ? `Your ${parts[0]}.`
      : `Your ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profile" description={description} />
      <section aria-label="Account">
        {profile.ok ? <AccountCard profile={profile.data} /> : <SectionError title="Account" />}
      </section>
      {user.role === "manager" && (
        <section aria-label="Your scope">
          {profile.ok ? <ScopeCard scopes={profile.data.scopes} /> : <SectionError title="Your scope" />}
        </section>
      )}
      {career && (
        <section aria-label="My career">
          {career.ok ? (
            <CareerCard roleName={career.data.careerRoleName} careerStart={career.data.careerStart} yoeYears={career.data.yoeYears} />
          ) : (
            <SectionError title="My career" />
          )}
        </section>
      )}
      <ChangePasswordForm />
    </div>
  );
}
