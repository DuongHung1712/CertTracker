import * as React from "react";
import { Award, Clock, Info, ShieldCheck, UserCheck } from "lucide-react";
import type { Skill } from "../types";
import { SkillLevelBadge } from "./skill-level-badge";
import { Button } from "@/components/ui/button";

interface SkillTableProps {
  skills: Skill[];
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
}

export function SkillTable({ skills, onViewDetails, onAssess }: SkillTableProps) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-table">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Code
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Skill &amp; Domain
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Category
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Level &amp; Target
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Verification
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-label uppercase text-muted-foreground font-semibold">
              Proof / Evidence
            </th>
            <th data-slot="table-head" className="px-2.5 py-1 text-right text-label uppercase text-muted-foreground font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {skills.map((skill) => {
            const isCertified = skill.verification === "certified";
            const isPending = skill.verification === "pending_review";

            return (
              <tr
                key={skill.id}
                className="group h-8 hover:bg-accent/40 transition-colors"
              >
                {/* Code */}
                <td data-slot="table-cell" className="px-2.5 py-1 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  <span className="vault-mono-tag">{skill.code}</span>
                </td>

                {/* Name */}
                <td data-slot="table-cell" className="px-2.5 py-1 max-w-xs">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => onViewDetails(skill)}
                      className="text-left font-medium text-foreground group-hover:text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs truncate max-w-full"
                    >
                      {skill.name}
                    </button>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {skill.description}
                    </span>
                  </div>
                </td>

                {/* Category */}
                <td data-slot="table-cell" className="px-2.5 py-1 whitespace-nowrap">
                  <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground uppercase">
                    {skill.category.replace("_", " & ")}
                  </span>
                </td>

                {/* Level */}
                <td data-slot="table-cell" className="px-2.5 py-1 whitespace-nowrap">
                  <SkillLevelBadge
                    currentLevel={skill.currentLevel}
                    targetLevel={skill.targetLevel}
                    size="sm"
                    showSegments={false}
                  />
                </td>

                {/* Verification */}
                <td data-slot="table-cell" className="px-2.5 py-1 whitespace-nowrap">
                  {isCertified ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-primary">
                      <span className="vault-live-dot vault-dot-emerald" aria-hidden="true" />
                      <ShieldCheck className="size-3.5" />
                      <span>Certified</span>
                    </span>
                  ) : isPending ? (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
                      <span className="vault-live-dot vault-dot-amber" aria-hidden="true" />
                      <Clock className="size-3.5" />
                      <span>Pending</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <UserCheck className="size-3.5" />
                      <span>Self-assessed</span>
                    </span>
                  )}
                </td>

                {/* Proof */}
                <td data-slot="table-cell" className="px-2.5 py-1 max-w-xs truncate text-[11px] text-muted-foreground">
                  {skill.certifiedProof ? (
                    <span className="inline-flex items-center gap-1 font-medium text-foreground truncate">
                      <Award className="size-3 text-primary shrink-0" />
                      <span className="truncate">{skill.certifiedProof.certificateName}</span>
                    </span>
                  ) : skill.evidenceNote ? (
                    <span className="italic truncate">{skill.evidenceNote}</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>

                {/* Actions */}
                <td data-slot="table-cell" className="px-2.5 py-1 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(skill)}
                      className="h-7 px-2 text-caption font-medium"
                    >
                      <Info className="size-3.5" />
                      <span className="sr-only">Details</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAssess(skill)}
                      className="h-7 px-2 text-caption font-medium hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    >
                      Assess
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
