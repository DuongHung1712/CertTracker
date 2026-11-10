import { RoleBadge } from "@/components/status/role-badge";
import { MemberCode } from "@/components/status/member-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyProfile } from "@/features/profile/queries";

/** Name and e-mail are read-only: changes go through the admin (decision #63). */
export function AccountCard({ profile }: { profile: MyProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">Account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-caption text-muted-foreground">Name</dt>
            <dd>{profile.fullName ?? "Not linked to a member"}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt className="text-caption text-muted-foreground">Role</dt>
            <dd>
              <RoleBadge role={profile.role} />
            </dd>
          </div>
          {profile.memberCode && (
            <div>
              <dt className="text-caption text-muted-foreground">Member code</dt>
              <dd>
                <MemberCode code={profile.memberCode} />
              </dd>
            </div>
          )}
          {profile.teamName && (
            <div>
              <dt className="text-caption text-muted-foreground">Team</dt>
              <dd>{profile.teamName}</dd>
            </div>
          )}
        </dl>
        <p className="text-caption text-muted-foreground">Ask your admin to change your name or email.</p>
      </CardContent>
    </Card>
  );
}
