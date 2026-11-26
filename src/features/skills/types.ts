export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type SkillCategory =
  | "cloud"
  | "backend"
  | "frontend"
  | "mobile"
  | "devops"
  | "security"
  | "data_ai"
  | "embedded"
  | "leadership";

export type VerificationStatus =
  | "certified"
  | "self_assessed"
  | "pending_review"
  | "returned";

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
  code: string; // e.g. "SKL-CLD-01" or "DC34-001"
  name: string;
  category: SkillCategory;
  description: string;
  currentLevel: SkillLevel;
  verification: VerificationStatus;
  certifiedProof?: CertifiedProof;
  yearsOfExperience: number;
  lastEvaluatedAt: string;
  evidenceNote?: string;
  reviewNote?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  isSaved?: boolean;
  recommendedCourses?: RecommendedCourse[];
}

export interface SkillStats {
  totalSkills: number;
  certifiedCount: number;
  selfAssessedCount: number;
  pendingReviewCount: number;
  returnedCount: number;
  averageLevel: number;
  strongCount: number;
  certifiedPercentage: number;
}

export interface RoleBenchmark {
  roleName: string;
  teamName: string;
  experienceLevel: string;
  description: string;
}

export type SkillSortOption =
  | "level-desc"
  | "level-asc"
  | "name-asc"
  | "recent";

export type SkillVerificationFilter = "all" | VerificationStatus;

export interface SkillFilterOptions {
  category: "all" | SkillCategory;
  verification: SkillVerificationFilter;
  query: string;
  sortBy: SkillSortOption;
}

export interface PendingSkillReview {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  teamName: string | null;
  skillId: string;
  skillCode: string;
  skillName: string;
  category: SkillCategory;
  evidenceNote: string | null;
  yearsOfExperience: number;
  lastEvaluatedAt: string;
}

export interface MemberSkillSummary {
  totalSkills: number;
  certifiedCount: number;
  pendingReviewCount: number;
  returnedCount: number;
  averageLevel: number;
}

export interface SkillsWorkspaceMember {
  id: string;
  code: string;
  fullName: string;
  teamName: string | null;
}

export type SkillsWorkspaceData =
  | {
      status: "ok";
      targetMember: SkillsWorkspaceMember;
      benchmark: RoleBenchmark;
      profileSkills: Skill[];
      catalogSkills: Skill[];
      canEdit: boolean;
      canReview: boolean;
      isOwnProfile: boolean;
      pendingReviews: PendingSkillReview[];
    }
  | { status: "not_found" };
