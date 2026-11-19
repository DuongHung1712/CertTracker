export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type SkillCategory =
  | "cloud"
  | "backend"
  | "frontend"
  | "devops"
  | "security"
  | "data_ai"
  | "leadership";

export type VerificationStatus = "certified" | "self_assessed" | "pending_review";

export interface CertifiedProof {
  certificateName: string;
  certificateCode: string;
  issuer: string;
  verifiedDate: string; // ISO or YYYY-MM-DD
  expiryDate?: string | null;
  credentialUrl?: string;
  recordId?: string;
}

export interface RecommendedCourse {
  title: string;
  provider: string;
  targetLevel: SkillLevel;
  durationHours: number;
  courseCode?: string;
}

export interface Skill {
  id: string;
  code: string; // e.g. "SKL-CLD-01"
  name: string;
  category: SkillCategory;
  description: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel; // Benchmark for member's role
  verification: VerificationStatus;
  certifiedProof?: CertifiedProof;
  yearsOfExperience: number;
  lastEvaluatedAt: string;
  evidenceNote?: string;
  recommendedCourses?: RecommendedCourse[];
}

export interface SkillStats {
  totalSkills: number;
  certifiedCount: number;
  selfAssessedCount: number;
  pendingReviewCount: number;
  averageLevel: number;
  targetMetCount: number;
  gapCount: number;
  certifiedPercentage: number;
}

export interface RoleBenchmark {
  roleName: string;
  teamName: string;
  experienceLevel: string;
  description: string;
  overallTargetScore: number;
}

export type SkillSortOption =
  | "level-desc"
  | "level-asc"
  | "gap-desc"
  | "name-asc"
  | "recent";

export type SkillVerificationFilter =
  | "all"
  | "certified"
  | "self_assessed"
  | "pending_review"
  | "gaps_only";

export interface SkillFilterOptions {
  category: "all" | SkillCategory;
  verification: SkillVerificationFilter;
  query: string;
  sortBy: SkillSortOption;
}
