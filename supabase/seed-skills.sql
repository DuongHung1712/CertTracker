-- ==============================================================================
-- CertTracker Demo Seed Script: 'My Skills' Capability
-- Target Feature: WBS 11.1–11.3 (Skills Matrix, Certification Verification & Gaps)
-- ==============================================================================

-- 1. Insert or update standard Skill Domains
insert into public.skill_domains (id, name, slug, sort_order) values
  ('5eed0000-0000-0000-0000-00000000d001', 'Cloud & Infrastructure', 'cloud', 1),
  ('5eed0000-0000-0000-0000-00000000d002', 'Backend & Systems', 'backend', 2),
  ('5eed0000-0000-0000-0000-00000000d003', 'Frontend & Web', 'frontend', 3),
  ('5eed0000-0000-0000-0000-00000000d004', 'DevOps & SRE', 'devops', 4),
  ('5eed0000-0000-0000-0000-00000000d005', 'Security & Compliance', 'security', 5),
  ('5eed0000-0000-0000-0000-00000000d006', 'Data & AI', 'data_ai', 6),
  ('5eed0000-0000-0000-0000-00000000d007', 'Leadership & Architecture', 'leadership', 7)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

-- 2. Insert or update 16 standard IT Skills
insert into public.skills (id, code, name, domain_id, description, benchmark_level, sort_order) values
  ('5eed0000-0000-0000-0000-00000000s001', 'SKL-CLD-01', 'Cloud Architecture & AWS Services', '5eed0000-0000-0000-0000-00000000d001', 'Designing high-availability, fault-tolerant VPCs, multi-region architectures, and serverless compute clusters on AWS.', 4, 1),
  ('5eed0000-0000-0000-0000-00000000s002', 'SKL-OPS-01', 'Kubernetes & Container Orchestration', '5eed0000-0000-0000-0000-00000000d004', 'Deploying, scaling, and operating multi-tenant Kubernetes clusters with custom CRDs, Helm charts, and ingress routing.', 3, 2),
  ('5eed0000-0000-0000-0000-00000000s003', 'SKL-CLD-02', 'Infrastructure as Code (Terraform)', '5eed0000-0000-0000-0000-00000000d001', 'Declarative infrastructure management, remote state locking, reusable modularization, and drift remediation.', 3, 3),
  ('5eed0000-0000-0000-0000-00000000s004', 'SKL-FED-01', 'Modern Frontend (Next.js & React)', '5eed0000-0000-0000-0000-00000000d003', 'App Router, React Server Components (RSC), streaming SSR, accessible design systems, and client caching strategies.', 3, 4),
  ('5eed0000-0000-0000-0000-00000000s005', 'SKL-FED-02', 'TypeScript & Type-Level Design', '5eed0000-0000-0000-0000-00000000d003', 'Strict compile-time type safety, conditional types, generic inference, and type-safe schema synchronization.', 4, 5),
  ('5eed0000-0000-0000-0000-00000000s006', 'SKL-BED-01', 'Distributed Systems & Resilient Messaging', '5eed0000-0000-0000-0000-00000000d002', 'Saga patterns, idempotency keys, outbox transaction patterns, and distributed locking in distributed architectures.', 4, 6),
  ('5eed0000-0000-0000-0000-00000000s007', 'SKL-BED-02', 'PostgreSQL & Relational Data Modeling', '5eed0000-0000-0000-0000-00000000d002', 'ACID transactions, Row-Level Security (RLS) policies, partial indices, EXPLAIN ANALYZE execution plan tuning.', 3, 7),
  ('5eed0000-0000-0000-0000-00000000s008', 'SKL-SEC-01', 'Information Security & CISSP Principles', '5eed0000-0000-0000-0000-00000000d005', 'Security architecture, CISSP domains, OWASP Top 10 mitigation, OAuth2/OIDC token flows, cryptographic signature verification, and secret rotation.', 3, 8),
  ('5eed0000-0000-0000-0000-00000000s009', 'SKL-OPS-02', 'CI/CD & GitOps Automation', '5eed0000-0000-0000-0000-00000000d004', 'Building automated container build pipelines, semantic versioning, artifact signing, and automated rollback triggers.', 3, 9),
  ('5eed0000-0000-0000-0000-00000000s010', 'SKL-OPS-03', 'Observability & SRE (OpenTelemetry & Grafana)', '5eed0000-0000-0000-0000-00000000d004', 'SLO/SLI tracking, structured logging, distributed tracing with OpenTelemetry, and Prometheus alerting rules.', 3, 10),
  ('5eed0000-0000-0000-0000-00000000s011', 'SKL-AI-01', 'Generative AI Systems & LLM Tooling', '5eed0000-0000-0000-0000-00000000d006', 'Prompt engineering, function calling, tool use schemas, local embedding index pipelines, and RAG architectures.', 2, 11),
  ('5eed0000-0000-0000-0000-00000000s012', 'SKL-BED-03', 'API Design & Protocol Architecture (gRPC & REST)', '5eed0000-0000-0000-0000-00000000d002', 'Designing versioned API contracts, protobuf schemas, streaming RPCs, rate-limiting, and backwards-compatibility.', 4, 12),
  ('5eed0000-0000-0000-0000-00000000s013', 'SKL-BED-04', 'System Architecture & Scalability Patterns', '5eed0000-0000-0000-0000-00000000d002', 'Designing event-driven backbones, caching strategies (Redis), data sharding, and fail-safe fallback policies.', 4, 13),
  ('5eed0000-0000-0000-0000-00000000s014', 'SKL-LEA-01', 'Technical Mentorship & Code Standards', '5eed0000-0000-0000-0000-00000000d007', 'Conducting high-impact code reviews, facilitating technical architectural spikes, and mentoring junior engineers.', 3, 14),
  ('5eed0000-0000-0000-0000-00000000s015', 'SKL-AI-02', 'Stream Processing & Real-time Data (Kafka)', '5eed0000-0000-0000-0000-00000000d006', 'Consumer group rebalancing, partition keys, compaction topics, and exactly-once processing semantics.', 2, 15),
  ('5eed0000-0000-0000-0000-00000000s016', 'SKL-FED-03', 'Web Performance & Core Web Vitals Optimization', '5eed0000-0000-0000-0000-00000000d003', 'INP optimization, LCP resource budgeting, font loading optimization, bundle tree-shaking, and frame budgeting.', 3, 16)
on conflict (code) do update set
  name = excluded.name,
  domain_id = excluded.domain_id,
  description = excluded.description,
  benchmark_level = excluded.benchmark_level,
  sort_order = excluded.sort_order;

-- 3. Link Skills to Database Certificates
insert into public.skill_certificate_links (skill_id, certificate_id, proves_level)
select
  '5eed0000-0000-0000-0000-00000000s001',
  '5eed0000-0000-0000-0000-00000000e001',
  3
where exists (select 1 from public.certificates where id = '5eed0000-0000-0000-0000-00000000e001')
on conflict (skill_id, certificate_id) do nothing;

insert into public.skill_certificate_links (skill_id, certificate_id, proves_level)
select
  '5eed0000-0000-0000-0000-00000000s011',
  '5eed0000-0000-0000-0000-00000000e002',
  2
where exists (select 1 from public.certificates where id = '5eed0000-0000-0000-0000-00000000e002')
on conflict (skill_id, certificate_id) do nothing;

-- 4. Seed Member Skills for Demo Member Lê Minh Châu (member@certtracker.test)
insert into public.member_skills (
  member_id, skill_id, current_level, years_of_experience,
  verification_status, evidence_note, last_evaluated_at
) values
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s001', 4, 5, 'certified', 'Led production migration of core microservices to AWS EKS with multi-AZ failover and IAM Role for Service Accounts.', '2026-10-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s002', 3, 3, 'certified', 'Maintains production Kubernetes manifests, node pools, and pod disruption budgets across 3 clusters.', '2026-09-20'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s003', 4, 4, 'certified', 'Author of our internal VPC & RDS reusable Terraform modules used across 6 client project repositories.', '2026-11-01'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s004', 4, 5, 'self_assessed', 'Architected CertTracker UI with Base UI, accessible radix primitives, and strict dual-axis theme switcher.', '2026-11-12'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s005', 4, 4, 'certified', 'Enforced zero-any lint rules across codebase; maintained Supabase auto-generated schema bindings.', '2026-10-18'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s006', 3, 3, 'self_assessed', 'Implemented transactional outbox pattern for notification queue in Go microservice.', '2026-08-30'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s007', 3, 4, 'certified', 'Designed CertTracker RLS security invoker policies and compound indices for 100k+ certificate rows.', '2026-09-10'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s008', 2, 2, 'self_assessed', 'Implemented PKCE auth flow and CSRF protections across team internal web properties.', '2026-07-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s009', 3, 3, 'certified', 'Engineered zero-downtime deployment pipelines with Vitest and Playwright end-to-end regression gates.', '2026-10-02'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s010', 2, 2, 'self_assessed', 'Configured Grafana dashboards for API response p99 latency and database connection pool saturation.', '2026-08-14'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s011', 2, 2, 'certified', 'Integrated server-side DeepSeek analysis pipelines with sanitized member IDs respecting decision #50.', '2026-11-05'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s012', 4, 4, 'self_assessed', 'Authored OpenAPI 3.1 specifications and unified response envelope patterns for all team services.', '2026-10-25'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s013', 3, 4, 'pending_review', 'Submitted RFC for asynchronous export worker queue. Endorsement review requested from DC Manager for Level 4 promotion.', '2026-11-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s014', 3, 3, 'self_assessed', 'Mentored 2 junior engineers through their first production release cycle; authored team Git conventions guide.', '2026-10-30'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s015', 1, 1, 'self_assessed', 'Basic event listener consumer implemented in development environment.', '2026-06-12'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000s016', 3, 3, 'certified', 'Achieved sub-100ms LCP on CertTracker dashboard views with zero cumulative layout shift (CLS).', '2026-09-18')
on conflict (member_id, skill_id) do update set
  current_level = excluded.current_level,
  years_of_experience = excluded.years_of_experience,
  verification_status = excluded.verification_status,
  evidence_note = excluded.evidence_note,
  last_evaluated_at = excluded.last_evaluated_at;
