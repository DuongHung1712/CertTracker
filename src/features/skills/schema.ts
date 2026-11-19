import { z } from "zod";
import type { SkillCategory, SkillLevel } from "./types";

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; icon: string }[] = [
  { id: "backend", label: "Backend & Systems", icon: "Server" },
  { id: "frontend", label: "Frontend & Web", icon: "Layout" },
  { id: "mobile", label: "Mobile Engineering", icon: "Smartphone" },
  { id: "cloud", label: "Cloud & Infrastructure", icon: "Cloud" },
  { id: "devops", label: "DevOps & SRE", icon: "Cpu" },
  { id: "data_ai", label: "Data & AI", icon: "Sparkles" },
  { id: "security", label: "Security & Compliance", icon: "Shield" },
  { id: "embedded", label: "Embedded & IoT", icon: "Cpu" },
  { id: "leadership", label: "Leadership & Collaboration", icon: "Users" },
];

export interface LevelDescription {
  level: SkillLevel;
  title: string;
  badgeLabel: string;
  percentageRange: string;
  officialLegend: string;
  summary: string;
  criteria: string;
  requiresReview: boolean;
}

export const LEVEL_SCALE_GUIDE: Record<SkillLevel, LevelDescription> = {
  0: {
    level: 0,
    title: "None",
    badgeLabel: "L0 · None",
    percentageRange: "0%",
    officialLegend: "No idea on the area (0%)",
    summary: "No prior experience or exposure (0%).",
    criteria: "Has not worked with this technology or concept in production.",
    requiresReview: false,
  },
  1: {
    level: 1,
    title: "Novice",
    badgeLabel: "L1 · Novice",
    percentageRange: "10-20%",
    officialLegend: "Know theory / limit knowledge (10-20%)",
    summary: "Basic understanding and theory (10-20%).",
    criteria: "Can execute routine, well-defined tasks under direct guidance.",
    requiresReview: false,
  },
  2: {
    level: 2,
    title: "Intermediate",
    badgeLabel: "L2 · Intermediate",
    percentageRange: "20-50%",
    officialLegend: "Minimal experience - with support from others (20-50%)",
    summary: "Practical working capability with support (20-50%).",
    criteria: "Autonomously delivers standard features, troubleshoots everyday issues.",
    requiresReview: false,
  },
  3: {
    level: 3,
    title: "Advanced",
    badgeLabel: "L3 · Advanced",
    percentageRange: "50-70%",
    officialLegend: "Average experience - can perform on own with minimal guidance (50-70%)",
    summary: "Independent practitioner and problem solver (50-70%).",
    criteria: "Deep domain knowledge, handles complex edge cases, designs module architecture.",
    requiresReview: false,
  },
  4: {
    level: 4,
    title: "Expert",
    badgeLabel: "L4 · Expert",
    percentageRange: "70-100%",
    officialLegend: "Advanced knowledge - extensive technical knowledge, go-to person, train others (70-100%)",
    summary: "Domain authority and cross-team mentor (70-100%).",
    criteria: "Drives system-wide technical decisions, establishes standards, mentors staff engineers.",
    requiresReview: false,
  },
  5: {
    level: 5,
    title: "Master",
    badgeLabel: "L5 · DC Master",
    percentageRange: "100%+",
    officialLegend: "SME / Expert - most experienced resource, extensive depth (100%+)",
    summary: "Department/DC recognized technical authority (100%+).",
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
