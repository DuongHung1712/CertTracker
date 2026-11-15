import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/components/status/labels";

// Tones are design tokens only; the label text carries the meaning, colour just helps scanning.
const ROLE_TONE: Record<Role, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-accent text-accent-foreground",
  member: "bg-secondary text-secondary-foreground",
};

export function RoleBadge({ role }: { role: Role }) {
  // shadcn's Badge defaults to rounded-4xl (8px); design-system.md §2.4 puts
  // badges at radius-sm (4px).
  return (
    <Badge variant="secondary" className={`rounded-sm ${ROLE_TONE[role]}`}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}
