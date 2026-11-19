import { z } from "zod";
import type { SkillCategory, SkillLevel } from "./types";

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; icon: string }[] = [
  { id: "cloud", label: "Cloud & Infrastructure", icon: "Cloud" },
  { id: "backend", label: "Backend & Systems", icon: "Server" },
  { id: "frontend", label: "Frontend & Web", icon: "Layout" },
  { id: "devops", label: "DevOps & SRE", icon: "Cpu" },
  { id: "security", label: "Security & Compliance", icon: "Shield" },
  { id: "data_ai", label: "Data & AI", icon: "Sparkles" },
  { id: "leadership", label: "Leadership & Collaboration", icon: "Users" },
];

export interface LevelDescription {
  level: SkillLevel;
  title: string;
  badgeLabel: string;
  summary: string;
  criteria: string;
  requiresReview: boolean;
}

export const LEVEL_SCALE_GUIDE: Record<SkillLevel, LevelDescription> = {
  0: {
    level: 0,
    title: "None",
    badgeLabel: "L0 · None",
    summary: "No prior experience or exposure.",
    criteria: "Has not worked with this technology or concept in production.",
    requiresReview: false,
  },
  1: {
    level: 1,
    title: "Novice",
    badgeLabel: "L1 · Novice",
    summary: "Basic understanding and fundamentals.",
    criteria: "Can execute routine, well-defined tasks under direct guidance.",
    requiresReview: false,
  },
  2: {
    level: 2,
    title: "Intermediate",
    badgeLabel: "L2 · Intermediate",
    summary: "Practical working capability.",
    criteria: "Autonomously delivers standard features, troubleshoots everyday issues.",
    requiresReview: false,
  },
  3: {
    level: 3,
    title: "Advanced",
    badgeLabel: "L3 · Advanced",
    summary: "Independent practitioner and problem solver.",
    criteria: "Deep domain knowledge, handles complex edge cases, designs module architecture.",
    requiresReview: false,
  },
  4: {
    level: 4,
    title: "Expert",
    badgeLabel: "L4 · Expert",
    summary: "Domain authority and cross-team mentor.",
    criteria: "Drives system-wide technical decisions, establishes standards, mentors staff engineers.",
    requiresReview: false,
  },
  5: {
    level: 5,
    title: "Master",
    badgeLabel: "L5 · DC Master",
    summary: "Department/DC recognized technical authority.",
    criteria: "Sets long-term strategic direction; requires review and endorsement from DC Manager.",
    requiresReview: true,
  },
};

export const updateSkillAssessmentSchema = z
  .object({
    skillId: z.string().min(1, "Skill ID is required"),
    newLevel: z.coerce.number().int().min(0).max(5).optional(),
    currentLevel: z.coerce.number().int().min(0).max(5).optional(),
    targetLevel: z.coerce.number().int().min(0).max(5).optional(),
    evidenceNote: z.string().max(1000, "Notes cannot exceed 1000 characters").optional(),
    yearsOfExperience: z.coerce.number().min(0).max(50),
    requestManagerReview: z.boolean().default(false),
  })
  .refine(
    (data) =>
      data.newLevel !== undefined ||
      data.currentLevel !== undefined ||
      data.targetLevel !== undefined,
    {
      message: "Competency level between 0 and 5 is required",
      path: ["newLevel"],
    },
  );

export type UpdateSkillAssessmentInput = z.infer<typeof updateSkillAssessmentSchema>;
