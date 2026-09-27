import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/components/status/labels";

export function RoleBadge({ role }: { role: Role }) {
  // shadcn's Badge defaults to rounded-4xl (8px); design-system.md §2.4 puts
  // badges at radius-sm (4px).
  return (
    <Badge variant="secondary" className="rounded-sm">
      {ROLE_LABEL[role]}
    </Badge>
  );
}
