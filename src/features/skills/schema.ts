import { z } from "zod";
import type { SkillCategory, SkillLevel } from "./types";

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; icon: string }[] = [
  { id: "backend", label: "Backend & Systems", icon: "Server" },
  { id: "frontend", label: "Frontend & Web", icon: "Layout" },
  { id: "mobile", label: "Mobile & Native", icon: "Smartphone" },
  { id: "cloud", label: "Cloud & Infrastructure", icon: "Cloud" },
  { id: "devops", label: "DevOps & SRE", icon: "Cpu" },
  { id: "data_ai", label: "Data & AI", icon: "Sparkles" },
  { id: "security", label: "Security & Compliance", icon: "Shield" },
  { id: "embedded", label: "Embedded & IoT", icon: "Cpu" },
  { id: "leadership", label: "Leadership & Collaboration", icon: "Users" },
];

export const SKILL_LEVELS: readonly SkillLevel[] = [0, 1, 2, 3, 4, 5];

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
    officialLegend: "Know theory / limited knowledge (10-20%)",
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

const skillLevelSchema = z.preprocess(
  (value) => (value === "" || value === null ? Number.NaN : value),
  z.coerce
    .number("Competency level must be a number")
    .int("Competency level must be a whole number")
    .min(0, "Competency level must be between 0 and 5")
    .max(5, "Competency level must be between 0 and 5"),
);

export const quickRateSkillSchema = z.object({
  skillId: z.guid("Skill ID is required"),
  level: skillLevelSchema,
});

export type QuickRateSkillInput = z.infer<typeof quickRateSkillSchema>;

export const updateSkillAssessmentSchema = z
  .object({
    skillId: z.guid("Skill ID is required"),
    newLevel: skillLevelSchema.optional(),
    currentLevel: skillLevelSchema.optional(),
    evidenceNote: z.string().trim().max(1000, "Notes cannot exceed 1000 characters").nullish(),
    yearsOfExperience: z.preprocess(
      (value) => (value === "" || value === null ? Number.NaN : value),
      z.coerce
        .number("Years of experience must be a number")
        .min(0, "Years of experience cannot be negative")
        .max(50, "Years of experience cannot exceed 50")
        .refine(Number.isFinite, "Years of experience must be a valid number"),
    ),
  })
  .refine(
    (data) => data.newLevel !== undefined || data.currentLevel !== undefined,
    {
      message: "Competency level between 0 and 5 is required",
      path: ["newLevel"],
    },
  );

export type UpdateSkillAssessmentInput = z.infer<typeof updateSkillAssessmentSchema>;

export const batchSkillAssessmentItemSchema = z.object({
  skillId: z.guid("Skill ID is required"),
  level: skillLevelSchema,
});

export const batchSaveSkillAssessmentsSchema = z.object({
  items: z
    .array(batchSkillAssessmentItemSchema)
    .min(1, "Rate at least one skill before saving")
    .max(300, "Cannot save more than 300 skills at once")
    .refine(
      (items) => new Set(items.map((item) => item.skillId)).size === items.length,
      "Duplicate skill entries are not allowed",
    ),
});

export type BatchSaveSkillAssessmentsInput = z.infer<typeof batchSaveSkillAssessmentsSchema>;

export const removeMemberSkillSchema = z.object({
  skillId: z.guid("Skill ID is required"),
});

export type RemoveMemberSkillInput = z.infer<typeof removeMemberSkillSchema>;

export const reviewMemberSkillSchema = z
  .object({
    memberId: z.guid("Member ID is required"),
    skillId: z.guid("Skill ID is required"),
    decision: z.enum(["approve", "return"]),
    note: z.string().trim().max(1000, "Review note cannot exceed 1000 characters").optional(),
  })
  .refine(
    (value) => value.decision === "approve" || (typeof value.note === "string" && value.note.length > 0),
    {
      path: ["note"],
      message: "Write what the member should fix.",
    },
  );

export type ReviewMemberSkillInput = z.infer<typeof reviewMemberSkillSchema>;
