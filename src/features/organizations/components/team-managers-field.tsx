"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Candidate = { userId: string; fullName: string; email: string };

export function TeamManagersField({
  candidates,
  selected,
  onChange,
}: {
  candidates: Candidate[];
  selected: string[];
  onChange: (userIds: string[]) => void;
}) {
  if (candidates.length === 0) {
    return <p className="text-caption text-muted-foreground">Chưa có tài khoản nào mang vai trò Quản lý.</p>;
  }

  return (
    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
      {candidates.map((candidate) => {
        const checked = selected.includes(candidate.userId);
        const id = `manager-${candidate.userId}`;
        return (
          <Label key={candidate.userId} htmlFor={id} className="flex items-center gap-2 text-body">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...selected, candidate.userId] : selected.filter((id) => id !== candidate.userId))
              }
            />
            {candidate.fullName}
            <span className="text-caption text-muted-foreground">{candidate.email}</span>
          </Label>
        );
      })}
    </div>
  );
}
