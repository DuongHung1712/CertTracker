import type { CertifiedProof, Skill, SkillCategory, SkillLevel, VerificationStatus } from "../types";

const proof = (certificateName: string, certificateCode: string): CertifiedProof => ({
  certificateName,
  certificateCode,
  issuer: "AWS",
  verifiedDate: "2025-11-14",
  expiryDate: "2028-11-14",
  recordId: "5eed0000-0000-0000-0000-00000000e001",
});

const skill = (
  n: number,
  category: SkillCategory,
  name: string,
  currentLevel: SkillLevel,
  verification: VerificationStatus,
  certifiedProof?: CertifiedProof,
): Skill => ({
  id: `skl-0${n}`,
  code: `SKL-TST-0${n}`,
  name,
  category,
  description: `${name} in production systems.`,
  currentLevel,
  verification,
  certifiedProof,
  yearsOfExperience: currentLevel,
  lastEvaluatedAt: `2026-10-1${n}`,
  isSaved: true,
});

/** Six saved skills: 3 certified, 2 self-rated, 1 waiting for review; average level 3.0; 4 backend. */
export const SKILL_FIXTURES: Skill[] = [
  skill(1, "cloud", "Kubernetes & Container Orchestration", 4, "certified", proof("AWS Certified Solutions Architect - Associate", "SAA-C03")),
  skill(2, "backend", "Distributed Systems & Resilient Messaging", 3, "certified", proof("AWS Certified Developer - Associate", "DVA-C02")),
  skill(3, "frontend", "Modern Frontend (Next.js & React)", 2, "self_assessed"),
  skill(4, "backend", "Python (FastAPI & AsyncIO)", 5, "pending_review"),
  skill(5, "backend", "PostgreSQL & Relational Data Modeling", 3, "certified", proof("AWS Certified Database - Specialty", "DBS-C01")),
  skill(6, "backend", "API Design & Protocol Architecture (gRPC & REST)", 1, "self_assessed"),
];
