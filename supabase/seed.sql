-- Local development seed. Test-only credentials; never used outside local Supabase.
-- UUIDs use the 5eed prefix so they never collide with pgTAP fixtures (tests run on the seeded DB).
insert into public.dcs (id, name) values ('5eed0000-0000-0000-0000-0000000000d1', 'DC34');
insert into public.programs (id, name, dc_id)
  values ('5eed0000-0000-0000-0000-0000000000f1', 'Digital Delivery', '5eed0000-0000-0000-0000-0000000000d1');
insert into public.teams (id, name, program_id) values
  ('5eed0000-0000-0000-0000-00000000a001', 'Team Cloud', '5eed0000-0000-0000-0000-0000000000f1'),
  ('5eed0000-0000-0000-0000-00000000a002', 'Team AI', '5eed0000-0000-0000-0000-0000000000f1');

insert into public.members (id, full_name, email, team_id) values
  ('5eed0000-0000-0000-0000-00000000b001', 'Nguyễn Văn An', 'an@certtracker.test', '5eed0000-0000-0000-0000-00000000a001'),
  ('5eed0000-0000-0000-0000-00000000b002', 'Trần Thị Bình', 'binh@certtracker.test', '5eed0000-0000-0000-0000-00000000a002'),
  ('5eed0000-0000-0000-0000-00000000b003', 'Lê Minh Châu', 'member@certtracker.test', '5eed0000-0000-0000-0000-00000000a001');

insert into public.cert_types (id, name) values
  ('5eed0000-0000-0000-0000-00000000c001', 'Cloud'),
  ('5eed0000-0000-0000-0000-00000000c002', 'AI');
insert into public.providers (id, name) values
  ('5eed0000-0000-0000-0000-00000000c101', 'AWS'),
  ('5eed0000-0000-0000-0000-00000000c102', 'NVIDIA'),
  ('5eed0000-0000-0000-0000-00000000c103', 'DeepLearning.AI');
-- Certificates and courses share ids for the two exams, as after the catalogue migration.
insert into public.certificates (id, name, kind, cert_type_id, provider_id, level, validity_months, url) values
  ('5eed0000-0000-0000-0000-00000000e001', 'AWS Solutions Architect Associate', 'exam',
   '5eed0000-0000-0000-0000-00000000c001', '5eed0000-0000-0000-0000-00000000c101', 'Associate', 36,
   'https://aws.amazon.com/certification/certified-solutions-architect-associate/'),
  ('5eed0000-0000-0000-0000-00000000e002', 'NVIDIA Generative AI LLMs', 'exam',
   '5eed0000-0000-0000-0000-00000000c002', '5eed0000-0000-0000-0000-00000000c102', 'Associate', 24, null);
insert into public.courses (id, name, provider_id, refundable, cost, cost_currency, est_hours, prepares_for_id) values
  ('5eed0000-0000-0000-0000-00000000e001', 'AWS Solutions Architect Associate',
   '5eed0000-0000-0000-0000-00000000c101', true, null, null, null, '5eed0000-0000-0000-0000-00000000e001'),
  ('5eed0000-0000-0000-0000-00000000e002', 'NVIDIA Generative AI LLMs',
   '5eed0000-0000-0000-0000-00000000c102', false, null, null, null, '5eed0000-0000-0000-0000-00000000e002'),
  ('5eed0000-0000-0000-0000-00000000e003', 'Machine Learning Specialization',
   '5eed0000-0000-0000-0000-00000000c103', false, null, null, null, null);
-- A course completion (no validity) granted by the course above; no records, for the e2e. Same provider as supabase/catalog/courses.sql,
-- whose page states no total hours and only a monthly subscription, so hours and cost are empty here too.
insert into public.certificates (id, name, kind, cert_type_id, provider_id, course_id) values
  ('5eed0000-0000-0000-0000-00000000e103', 'Machine Learning Specialization', 'completion',
   '5eed0000-0000-0000-0000-00000000c002', '5eed0000-0000-0000-0000-00000000c103',
   '5eed0000-0000-0000-0000-00000000e003');

insert into public.training_records (member_id, certificate_id, course_id, status, progress, issued_date, planned_exam_date) values
  ('5eed0000-0000-0000-0000-00000000b001', '5eed0000-0000-0000-0000-00000000e001', '5eed0000-0000-0000-0000-00000000e001', 'done', 100, public.vn_today() - 1070, null);

-- The journey (decision #72): Bình studies the NVIDIA course for its exam; Châu plans AWS on her own.
insert into public.learning_items (member_id, course_id, target_certificate_id, status, progress, planned_date) values
  ('5eed0000-0000-0000-0000-00000000b002', '5eed0000-0000-0000-0000-00000000e002', '5eed0000-0000-0000-0000-00000000e002', 'in_progress', 40, public.vn_today() + 20),
  ('5eed0000-0000-0000-0000-00000000b003', null, '5eed0000-0000-0000-0000-00000000e001', 'not_started', 0, null);

-- Login users (email + password). Members must exist first so the profile trigger links them.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('5eed0000-0000-0000-0000-00000000f00a'::uuid, 'admin@certtracker.test'),
  ('5eed0000-0000-0000-0000-00000000f00b'::uuid, 'manager@certtracker.test'),
  ('5eed0000-0000-0000-0000-00000000f00c'::uuid, 'member@certtracker.test')
) as u (id, email);

insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, json_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.email like '%@certtracker.test';

update public.profiles set role = 'admin' where user_id = '5eed0000-0000-0000-0000-00000000f00a';
update public.profiles set role = 'manager' where user_id = '5eed0000-0000-0000-0000-00000000f00b';
insert into public.manager_scopes (team_id, user_id)
  values ('5eed0000-0000-0000-0000-00000000a001', '5eed0000-0000-0000-0000-00000000f00b');

-- Skills matrix demo data (moved from migration 20261119000001: it names seed-only members and certificates).
-- Seed Domains
insert into public.skill_domains (id, name, slug, sort_order) values
  ('5eed0000-0000-0000-0000-00000000d001', 'Cloud & Infrastructure', 'cloud', 1),
  ('5eed0000-0000-0000-0000-00000000d002', 'Backend & Systems', 'backend', 2),
  ('5eed0000-0000-0000-0000-00000000d003', 'Frontend & Web', 'frontend', 3),
  ('5eed0000-0000-0000-0000-00000000d004', 'DevOps & SRE', 'devops', 4),
  ('5eed0000-0000-0000-0000-00000000d005', 'Security & Compliance', 'security', 5),
  ('5eed0000-0000-0000-0000-00000000d006', 'Data & AI', 'data_ai', 6),
  ('5eed0000-0000-0000-0000-00000000d007', 'Leadership & Architecture', 'leadership', 7)
on conflict (slug) do nothing;

-- Seed Standard Skills
insert into public.skills (id, code, name, domain_id, description, benchmark_level, sort_order) values
  ('5eed0000-0000-0000-0000-00000000a201', 'SKL-CLD-01', 'Cloud Architecture & AWS Services', '5eed0000-0000-0000-0000-00000000d001', 'Designing high-availability, fault-tolerant VPCs, multi-region architectures, and serverless compute clusters on AWS.', 4, 1),
  ('5eed0000-0000-0000-0000-00000000a202', 'SKL-OPS-01', 'Kubernetes & Container Orchestration', '5eed0000-0000-0000-0000-00000000d004', 'Deploying, scaling, and operating multi-tenant Kubernetes clusters with custom CRDs, Helm charts, and ingress routing.', 3, 2),
  ('5eed0000-0000-0000-0000-00000000a203', 'SKL-CLD-02', 'Infrastructure as Code (Terraform)', '5eed0000-0000-0000-0000-00000000d001', 'Declarative infrastructure management, remote state locking, reusable modularization, and drift remediation.', 3, 3),
  ('5eed0000-0000-0000-0000-00000000a204', 'SKL-FED-01', 'Modern Frontend (Next.js & React)', '5eed0000-0000-0000-0000-00000000d003', 'App Router, React Server Components (RSC), streaming SSR, accessible design systems, and client caching strategies.', 3, 4),
  ('5eed0000-0000-0000-0000-00000000a205', 'SKL-FED-02', 'TypeScript & Type-Level Design', '5eed0000-0000-0000-0000-00000000d003', 'Strict compile-time type safety, conditional types, generic inference, and type-safe schema synchronization.', 4, 5),
  ('5eed0000-0000-0000-0000-00000000a206', 'SKL-BED-01', 'Distributed Systems & Resilient Messaging', '5eed0000-0000-0000-0000-00000000d002', 'Saga patterns, idempotency keys, outbox transaction patterns, and distributed locking in distributed architectures.', 4, 6),
  ('5eed0000-0000-0000-0000-00000000a207', 'SKL-BED-02', 'PostgreSQL & Relational Data Modeling', '5eed0000-0000-0000-0000-00000000d002', 'ACID transactions, Row-Level Security (RLS) policies, partial indices, EXPLAIN ANALYZE execution plan tuning.', 3, 7),
  ('5eed0000-0000-0000-0000-00000000a208', 'SKL-SEC-01', 'Information Security & CISSP Principles', '5eed0000-0000-0000-0000-00000000d005', 'Security architecture, CISSP domains, OWASP Top 10 mitigation, OAuth2/OIDC token flows, cryptographic signature verification, and secret rotation.', 3, 8),
  ('5eed0000-0000-0000-0000-00000000a209', 'SKL-OPS-02', 'CI/CD & GitOps Automation', '5eed0000-0000-0000-0000-00000000d004', 'Building automated container build pipelines, semantic versioning, artifact signing, and automated rollback triggers.', 3, 9),
  ('5eed0000-0000-0000-0000-00000000a210', 'SKL-OPS-03', 'Observability & SRE (OpenTelemetry & Grafana)', '5eed0000-0000-0000-0000-00000000d004', 'SLO/SLI tracking, structured logging, distributed tracing with OpenTelemetry, and Prometheus alerting rules.', 3, 10),
  ('5eed0000-0000-0000-0000-00000000a211', 'SKL-AI-01', 'Generative AI Systems & LLM Tooling', '5eed0000-0000-0000-0000-00000000d006', 'Prompt engineering, function calling, tool use schemas, local embedding index pipelines, and RAG architectures.', 2, 11),
  ('5eed0000-0000-0000-0000-00000000a212', 'SKL-BED-03', 'API Design & Protocol Architecture (gRPC & REST)', '5eed0000-0000-0000-0000-00000000d002', 'Designing versioned API contracts, protobuf schemas, streaming RPCs, rate-limiting, and backwards-compatibility.', 4, 12),
  ('5eed0000-0000-0000-0000-00000000a213', 'SKL-BED-04', 'System Architecture & Scalability Patterns', '5eed0000-0000-0000-0000-00000000d002', 'Designing event-driven backbones, caching strategies (Redis), data sharding, and fail-safe fallback policies.', 4, 13),
  ('5eed0000-0000-0000-0000-00000000a214', 'SKL-LEA-01', 'Technical Mentorship & Code Standards', '5eed0000-0000-0000-0000-00000000d007', 'Conducting high-impact code reviews, facilitating technical architectural spikes, and mentoring junior engineers.', 3, 14),
  ('5eed0000-0000-0000-0000-00000000a215', 'SKL-AI-02', 'Stream Processing & Real-time Data (Kafka)', '5eed0000-0000-0000-0000-00000000d006', 'Consumer group rebalancing, partition keys, compaction topics, and exactly-once processing semantics.', 2, 15),
  ('5eed0000-0000-0000-0000-00000000a216', 'SKL-FED-03', 'Web Performance & Core Web Vitals Optimization', '5eed0000-0000-0000-0000-00000000d003', 'INP optimization, LCP resource budgeting, font loading optimization, bundle tree-shaking, and frame budgeting.', 3, 16)
on conflict (code) do nothing;

-- Link Skills to Certificates in Seed DB
insert into public.skill_certificate_links (skill_id, certificate_id, proves_level)
select
  '5eed0000-0000-0000-0000-00000000a201',
  '5eed0000-0000-0000-0000-00000000e001',
  3
where exists (select 1 from public.certificates where id = '5eed0000-0000-0000-0000-00000000e001')
on conflict (skill_id, certificate_id) do nothing;

insert into public.skill_certificate_links (skill_id, certificate_id, proves_level)
select
  '5eed0000-0000-0000-0000-00000000a211',
  '5eed0000-0000-0000-0000-00000000e002',
  2
where exists (select 1 from public.certificates where id = '5eed0000-0000-0000-0000-00000000e002')
on conflict (skill_id, certificate_id) do nothing;

-- Member Skills for Lê Minh Châu (member@certtracker.test, 5eed0000-0000-0000-0000-00000000b003)
insert into public.member_skills (
  member_id, skill_id, current_level, years_of_experience,
  verification_status, evidence_note, last_evaluated_at
) values
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a201', 4, 5, 'certified', 'Led production migration of core microservices to AWS EKS with multi-AZ failover and IAM Role for Service Accounts.', '2026-10-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a202', 3, 3, 'certified', 'Maintains production Kubernetes manifests, node pools, and pod disruption budgets across 3 clusters.', '2026-09-20'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a203', 4, 4, 'certified', 'Author of our internal VPC & RDS reusable Terraform modules used across 6 client project repositories.', '2026-11-01'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a204', 4, 5, 'self_assessed', 'Architected CertTracker UI with Base UI, accessible radix primitives, and strict dual-axis theme switcher.', '2026-11-12'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a205', 4, 4, 'certified', 'Enforced zero-any lint rules across codebase; maintained Supabase auto-generated schema bindings.', '2026-10-18'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a206', 3, 3, 'self_assessed', 'Implemented transactional outbox pattern for notification queue in Go microservice.', '2026-08-30'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a207', 3, 4, 'certified', 'Designed CertTracker RLS security invoker policies and compound indices for 100k+ certificate rows.', '2026-09-10'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a208', 2, 2, 'self_assessed', 'Implemented PKCE auth flow and CSRF protections across team internal web properties.', '2026-07-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a209', 3, 3, 'certified', 'Engineered zero-downtime deployment pipelines with Vitest and Playwright end-to-end regression gates.', '2026-10-02'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a210', 2, 2, 'self_assessed', 'Configured Grafana dashboards for API response p99 latency and database connection pool saturation.', '2026-08-14'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a211', 2, 2, 'certified', 'Integrated server-side DeepSeek analysis pipelines with sanitized member IDs respecting decision #50.', '2026-11-05'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a212', 4, 4, 'self_assessed', 'Authored OpenAPI 3.1 specifications and unified response envelope patterns for all team services.', '2026-10-25'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a213', 3, 4, 'pending_review', 'Submitted RFC for asynchronous export worker queue. Endorsement review requested from DC Manager for Level 4 promotion.', '2026-11-15'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a214', 3, 3, 'self_assessed', 'Mentored 2 junior engineers through their first production release cycle; authored team Git conventions guide.', '2026-10-30'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a215', 1, 1, 'self_assessed', 'Basic event listener consumer implemented in development environment.', '2026-06-12'),
  ('5eed0000-0000-0000-0000-00000000b003', '5eed0000-0000-0000-0000-00000000a216', 3, 3, 'certified', 'Achieved sub-100ms LCP on CertTracker dashboard views with zero cumulative layout shift (CLS).', '2026-09-18')
on conflict (member_id, skill_id) do nothing;
