import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type Role } from "@/components/status/labels";

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>;
}
