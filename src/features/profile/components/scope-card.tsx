import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyProfile } from "@/features/profile/queries";

/** The teams and programs a manager looks after (shown to managers only; RLS decides what the rows are). */
export function ScopeCard({ scopes }: { scopes: MyProfile["scopes"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">Your scope</CardTitle>
      </CardHeader>
      <CardContent>
        {scopes.length === 0 ? (
          <p className="text-muted-foreground">No teams or programs assigned yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {scopes.map((scope) => (
              <li key={`${scope.kind}:${scope.name}`}>
                {scope.name} <span className="text-caption text-muted-foreground">{scope.kind === "team" ? "Team" : "Program"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
