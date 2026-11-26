import { categoryLabel } from "../metrics";
import type { Skill, SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { SkillStatus } from "./skill-status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SkillTableProps {
  skills: Skill[];
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
  onQuickRate: (skillId: string, level: SkillLevel) => void;
}

export function SkillTable({ skills, onViewDetails, onAssess, onQuickRate }: SkillTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table className="text-table">
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                Your level
                <SkillLegendPopover align="start" />
              </span>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((skill) => (
            <TableRow key={skill.id}>
              <TableCell className="max-w-xs">
                <button
                  type="button"
                  onClick={() => onViewDetails(skill)}
                  className="block max-w-full truncate rounded-xs text-left font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {skill.name}
                </button>
                <span className="text-caption text-muted-foreground">{categoryLabel(skill.category)}</span>
              </TableCell>
              <TableCell>
                <SkillQuickRate
                  skillName={skill.name}
                  currentLevel={skill.currentLevel}
                  onRate={(level) => onQuickRate(skill.id, level)}
                />
              </TableCell>
              <TableCell>
                <SkillStatus status={skill.verification} />
              </TableCell>
              <TableCell className="max-w-56 truncate text-muted-foreground">
                {skill.certifiedProof?.certificateName ?? skill.evidenceNote ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="outline" aria-label={`Edit ${skill.name}`} onClick={() => onAssess(skill)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
