-- My Skills persistence & review flow (spec docs/superpowers/specs/2026-11-26-my-skills-persistence-design.md §3).
-- Seeds all 9 domains & 182 catalogue skills idempotently, enables 0.5 YoE precision, adds 'returned' + review_note,
-- tightens member_skills RLS + BEFORE triggers, and adds member_skills to supabase_realtime.

-- 1. Skill domains: align leadership label and add mobile & embedded.
insert into public.skill_domains (id, name, slug, sort_order) values
  ('5eed0000-0000-0000-0000-00000000d001', 'Cloud & Infrastructure', 'cloud', 1),
  ('5eed0000-0000-0000-0000-00000000d002', 'Backend & Systems', 'backend', 2),
  ('5eed0000-0000-0000-0000-00000000d003', 'Frontend & Web', 'frontend', 3),
  ('5eed0000-0000-0000-0000-00000000d004', 'DevOps & SRE', 'devops', 4),
  ('5eed0000-0000-0000-0000-00000000d005', 'Security & Compliance', 'security', 5),
  ('5eed0000-0000-0000-0000-00000000d006', 'Data & AI', 'data_ai', 6),
  ('5eed0000-0000-0000-0000-00000000d007', 'Leadership & Collaboration', 'leadership', 7),
  ('5eed0000-0000-0000-0000-00000000d008', 'Mobile & Native', 'mobile', 8),
  ('5eed0000-0000-0000-0000-00000000d009', 'Embedded & IoT', 'embedded', 9)
on conflict (slug) do update set name = excluded.name;

-- 2. Widen skills.code pattern to accept DC34-* codes and idempotently seed all 182 catalogue skills.
alter table public.skills
  drop constraint if exists skills_code_check,
  add constraint skills_code_check
    check (code ~ '^(SKL-[A-Z]{2,4}-[0-9]{2}|DC34-[0-9]{3})$');

insert into public.skills (id, code, name, domain_id, description, benchmark_level, sort_order)
select
  v.id,
  v.code,
  v.name,
  (select id from public.skill_domains where slug = v.domain_slug),
  v.description,
  v.benchmark_level,
  v.sort_order
from (values
  ('5eed0000-0000-0000-0000-00000000a201'::uuid, 'SKL-CLD-01', 'Cloud Architecture & AWS Services', 'cloud', 'Designing high-availability, fault-tolerant VPCs, multi-region architectures, and serverless compute clusters on AWS.', 4, 1),
  ('5eed0000-0000-0000-0000-00000000a202'::uuid, 'SKL-OPS-01', 'Kubernetes & Container Orchestration', 'devops', 'Deploying, scaling, and operating multi-tenant Kubernetes clusters with custom CRDs, Helm charts, and ingress routing.', 3, 2),
  ('5eed0000-0000-0000-0000-00000000a203'::uuid, 'SKL-CLD-02', 'Infrastructure as Code (Terraform)', 'cloud', 'Declarative infrastructure management, remote state locking, reusable modularization, and drift remediation.', 3, 3),
  ('5eed0000-0000-0000-0000-00000000a204'::uuid, 'SKL-FED-01', 'Modern Frontend (Next.js & React)', 'frontend', 'App Router, React Server Components (RSC), streaming SSR, accessible design systems, and client caching strategies.', 3, 4),
  ('5eed0000-0000-0000-0000-00000000a205'::uuid, 'SKL-FED-02', 'TypeScript & Type-Level Design', 'frontend', 'Strict compile-time type safety, conditional types, generic inference, and type-safe schema synchronization.', 4, 5),
  ('5eed0000-0000-0000-0000-00000000a206'::uuid, 'SKL-BED-01', 'Distributed Systems & Resilient Messaging', 'backend', 'Saga patterns, idempotency keys, outbox transaction patterns, and distributed locking in distributed architectures.', 4, 6),
  ('5eed0000-0000-0000-0000-00000000a207'::uuid, 'SKL-BED-02', 'PostgreSQL & Relational Data Modeling', 'backend', 'ACID transactions, Row-Level Security (RLS) policies, partial indices, EXPLAIN ANALYZE execution plan tuning.', 3, 7),
  ('5eed0000-0000-0000-0000-00000000a208'::uuid, 'SKL-SEC-01', 'Information Security & CISSP Principles', 'security', 'Security architecture, CISSP domains, OWASP Top 10 mitigation, OAuth2/OIDC token flows, cryptographic signature verification, and secret rotation.', 3, 8),
  ('5eed0000-0000-0000-0000-00000000a209'::uuid, 'SKL-OPS-02', 'CI/CD & GitOps Automation', 'devops', 'Building automated container build pipelines, semantic versioning, artifact signing, and automated rollback triggers.', 3, 9),
  ('5eed0000-0000-0000-0000-00000000a210'::uuid, 'SKL-OPS-03', 'Observability & SRE (OpenTelemetry & Grafana)', 'devops', 'SLO/SLI tracking, structured logging, distributed tracing with OpenTelemetry, and Prometheus alerting rules.', 3, 10),
  ('5eed0000-0000-0000-0000-00000000a211'::uuid, 'SKL-AI-01', 'Generative AI Systems & LLM Tooling', 'data_ai', 'Prompt engineering, function calling, tool use schemas, local embedding index pipelines, and RAG architectures.', 2, 11),
  ('5eed0000-0000-0000-0000-00000000a212'::uuid, 'SKL-BED-03', 'API Design & Protocol Architecture (gRPC & REST)', 'backend', 'Designing versioned API contracts, protobuf schemas, streaming RPCs, rate-limiting, and backwards-compatibility.', 4, 12),
  ('5eed0000-0000-0000-0000-00000000a213'::uuid, 'SKL-BED-04', 'System Architecture & Scalability Patterns', 'backend', 'Designing event-driven backbones, caching strategies (Redis), data sharding, and fail-safe fallback policies.', 4, 13),
  ('5eed0000-0000-0000-0000-00000000a214'::uuid, 'SKL-LEA-01', 'Technical Mentorship & Code Standards', 'leadership', 'Conducting high-impact code reviews, facilitating technical architectural spikes, and mentoring junior engineers.', 3, 14),
  ('5eed0000-0000-0000-0000-00000000a215'::uuid, 'SKL-AI-02', 'Stream Processing & Real-time Data (Kafka)', 'data_ai', 'Consumer group rebalancing, partition keys, compaction topics, and exactly-once processing semantics.', 2, 15),
  ('5eed0000-0000-0000-0000-00000000a216'::uuid, 'SKL-FED-03', 'Web Performance & Core Web Vitals Optimization', 'frontend', 'INP optimization, LCP resource budgeting, font loading optimization, bundle tree-shaking, and frame budgeting.', 3, 16),
  ('5eed0000-0000-0000-0000-00000000a217'::uuid, 'SKL-BED-05', 'Python (FastAPI & AsyncIO)', 'backend', 'High-throughput asynchronous APIs, Pydantic v2 validation models, dependency injection, and background task queues.', 3, 17),
  ('5eed0000-0000-0000-0000-00000000a218'::uuid, 'SKL-BED-06', 'Python (Django & Django REST Framework)', 'backend', 'Django ORM query optimization (select_related/prefetch_related), schema migrations, DRF viewsets, and middleware.', 3, 18),
  ('5eed0000-0000-0000-0000-00000000a219'::uuid, 'SKL-BED-07', 'Java (Spring Boot 3 & Microservices)', 'backend', 'Spring Boot 3, Spring Data JPA, Hibernate optimization, Spring Security OAuth2, and resilience with Resilience4j.', 3, 19),
  ('5eed0000-0000-0000-0000-00000000a220'::uuid, 'SKL-BED-08', 'Node.js & NestJS Architecture', 'backend', 'Enterprise modular design, custom decorators, interceptors, pipes, microservices transport (NATS/Kafka), and Prisma ORM.', 3, 20),
  ('5eed0000-0000-0000-0000-00000000a221'::uuid, 'SKL-BED-09', 'Go (Golang) Microservices & Concurrency', 'backend', 'Goroutines, channels, sync primitives, context cancellation, standard library HTTP, and zero-allocation protobuf encoders.', 3, 21),
  ('5eed0000-0000-0000-0000-00000000a222'::uuid, 'SKL-BED-10', 'Rust Systems & Web Services (Axum/Tokio)', 'backend', 'Borrow checker, lifetime annotations, Tokio asynchronous runtime, Axum HTTP handlers, and fearless concurrency.', 3, 22),
  ('5eed0000-0000-0000-0000-00000000a223'::uuid, 'SKL-BED-11', 'GraphQL API Design & Apollo Federation', 'backend', 'Schema-first design, Apollo Federation subgraphs, DataLoader batching to eliminate N+1 queries, and directives.', 3, 23),
  ('5eed0000-0000-0000-0000-00000000a224'::uuid, 'SKL-BED-12', 'C# & .NET 8 Web API', 'backend', 'ASP.NET Core Minimal APIs, Entity Framework Core 8, LINQ execution, dependency injection scopes, and background hosted services.', 3, 24),
  ('5eed0000-0000-0000-0000-00000000a225'::uuid, 'SKL-FED-04', 'React 19 & React Server Components (RSC)', 'frontend', 'Server Actions, optimistic UI with useOptimistic, Suspense streaming boundaries, and the use() hook.', 3, 25),
  ('5eed0000-0000-0000-0000-00000000a226'::uuid, 'SKL-FED-05', 'Vue.js 3 & Nuxt 3 Full-Stack', 'frontend', 'Composition API, script setup, Pinia store architecture, Nuxt 3 hybrid rendering, and server engine Nitro.', 3, 26),
  ('5eed0000-0000-0000-0000-00000000a227'::uuid, 'SKL-FED-06', 'Tailwind CSS & Design Token Architecture', 'frontend', 'CSS variables token binding, dark mode contrast compliance, utility-first CSS, Radix UI & Base UI primitive styling.', 3, 27),
  ('5eed0000-0000-0000-0000-00000000a228'::uuid, 'SKL-FED-07', 'State Management & Data Fetching (TanStack Query)', 'frontend', 'Server cache invalidation, optimistic rollbacks, query key factories, Zustand for client ui state, and stale-while-revalidate.', 3, 28),
  ('5eed0000-0000-0000-0000-00000000a229'::uuid, 'SKL-FED-08', 'Web Accessibility (WCAG 2.2 AA)', 'frontend', 'Accessible ARIA roles, focus management, screen reader announcements, contrast ratios, and keyboard tab traps.', 3, 29),
  ('5eed0000-0000-0000-0000-00000000a230'::uuid, 'SKL-FED-09', 'Frontend Testing Automation (Vitest & Playwright)', 'frontend', 'Component unit testing with Testing Library, mocking network boundaries, Playwright end-to-end visual regression.', 3, 30),
  ('5eed0000-0000-0000-0000-00000000a231'::uuid, 'SKL-MOB-01', 'React Native & Expo Cross-Platform', 'mobile', 'Expo Application Services (EAS), native TurboModules, React Native Reanimated gestures, and memory budgeting.', 3, 31),
  ('5eed0000-0000-0000-0000-00000000a232'::uuid, 'SKL-MOB-02', 'Flutter & Dart Mobile Architecture', 'mobile', 'Declarative widget trees, BLoC / Riverpod state architecture, platform channels, and high-fps custom paint animations.', 3, 32),
  ('5eed0000-0000-0000-0000-00000000a233'::uuid, 'SKL-MOB-03', 'iOS Native (Swift & SwiftUI)', 'mobile', 'Swift Concurrency (async/await, actors), SwiftUI declarative layouts, Combine reactive streams, and Keychain security.', 3, 33),
  ('5eed0000-0000-0000-0000-00000000a234'::uuid, 'SKL-MOB-04', 'Android Native (Kotlin & Jetpack Compose)', 'mobile', 'Kotlin Coroutines & Flow, Jetpack Compose UI, ViewModel state hoisting, Hilt dependency injection, and Room database.', 3, 34),
  ('5eed0000-0000-0000-0000-00000000a235'::uuid, 'SKL-MOB-05', 'Mobile Offline-First & SQLite Sync', 'mobile', 'Local relational caching with SQLite, two-way delta sync algorithms, conflict resolution (last-write-wins / CRDT).', 3, 35),
  ('5eed0000-0000-0000-0000-00000000a236'::uuid, 'SKL-MOB-06', 'Mobile CI/CD & App Store Delivery (Fastlane)', 'mobile', 'Automated code signing, provisioning profiles, Fastlane lanes, TestFlight builds, and Google Play Console internal tracks.', 3, 36),
  ('5eed0000-0000-0000-0000-00000000a237'::uuid, 'SKL-OPS-04', 'Docker & Container Image Optimization', 'devops', 'Multi-stage builds, distroless images, layer caching, rootless daemon configuration, and Trivy CVE vulnerability scans.', 3, 37),
  ('5eed0000-0000-0000-0000-00000000a238'::uuid, 'SKL-OPS-05', 'GitOps Continuous Delivery (ArgoCD & Flux)', 'devops', 'Declarative cluster state, automated drift detection, Argo Rollouts canary deployments with Prometheus analysis metrics.', 3, 38),
  ('5eed0000-0000-0000-0000-00000000a239'::uuid, 'SKL-OPS-06', 'Linux Systems Administration & Shell Scripting', 'devops', 'POSIX Bash scripting, systemd service units, networking (iptables/nftables), file permissions, and Linux performance analysis.', 3, 39),
  ('5eed0000-0000-0000-0000-00000000a240'::uuid, 'SKL-OPS-07', 'Incident Management & Chaos Engineering', 'devops', 'SLO error budget alerts, PagerDuty escalation policies, post-mortem RCA documentation, and Chaos Mesh fault injection.', 3, 40),
  ('5eed0000-0000-0000-0000-00000000a241'::uuid, 'SKL-CLD-03', 'Google Cloud Platform (GCP & GKE)', 'cloud', 'Google Kubernetes Engine (GKE), Cloud Run, BigQuery data analysis, Cloud Pub/Sub, IAM service account impersonation.', 3, 41),
  ('5eed0000-0000-0000-0000-00000000a242'::uuid, 'SKL-CLD-04', 'Microsoft Azure Cloud Infrastructure', 'cloud', 'Azure App Services, Azure Kubernetes Service (AKS), Azure SQL Managed Instances, Entra ID integration, and VNet peering.', 3, 42),
  ('5eed0000-0000-0000-0000-00000000a243'::uuid, 'SKL-CLD-05', 'Serverless Architecture (AWS Lambda & EventBridge)', 'cloud', 'Event-driven serverless backends, Lambda cold start tuning, EventBridge event buses, SQS dead-letter queues, DynamoDB single-table.', 3, 43),
  ('5eed0000-0000-0000-0000-00000000a244'::uuid, 'SKL-CLD-06', 'Cloud FinOps & Cost Optimization', 'cloud', 'AWS Savings Plans, Spot instance fleets, S3 intelligent tiering, CloudWatch metric alarms, and monthly cloud spend forecasting.', 3, 44),
  ('5eed0000-0000-0000-0000-00000000a245'::uuid, 'SKL-CLD-07', 'Cloud Security & Zero Trust IAM', 'cloud', 'AWS SCP policies, IAM Roles Anywhere, AWS GuardDuty threat detection, KMS envelope encryption, and VPC endpoint security.', 3, 45),
  ('5eed0000-0000-0000-0000-00000000a246'::uuid, 'SKL-DAT-01', 'Redis & In-Memory Data Structures', 'data_ai', 'Cache-aside patterns, Redis Streams, distributed locking (Redlock algorithm), sorted sets for leaderboard ranking, eviction policies.', 3, 46),
  ('5eed0000-0000-0000-0000-00000000a247'::uuid, 'SKL-DAT-02', 'NoSQL & Document Stores (MongoDB)', 'data_ai', 'Aggregation pipelines, compound index selectivity, replica set failover, document schema validation, and sharded clusters.', 3, 47),
  ('5eed0000-0000-0000-0000-00000000a248'::uuid, 'SKL-DAT-03', 'Vector Databases & RAG Architectures (pgvector)', 'data_ai', 'Cosine distance vs dot product indexing (HNSW/IVFFlat), embedding chunking strategies, hybrid keyword/vector search.', 3, 48),
  ('5eed0000-0000-0000-0000-00000000a249'::uuid, 'SKL-DAT-04', 'Data Engineering & Batch Pipelines (Spark & dbt)', 'data_ai', 'Dimensional data modeling (star schema), dbt data transformations, incremental models, and Spark DataFrame transformations.', 3, 49),
  ('5eed0000-0000-0000-0000-00000000a250'::uuid, 'SKL-DAT-05', 'MLOps & Model Serving Infrastructure', 'data_ai', 'Containerized model inference (FastAPI/vLLM), model versioning (MLflow), token latency benchmarking, and GPU instance provisioning.', 3, 50),
  ('5eed0000-0000-0000-0000-00000000a251'::uuid, 'SKL-DAT-06', 'Elasticsearch & Full-Text Search Tuning', 'data_ai', 'Custom tokenizers, analyzers, BM25 relevance scoring, index lifecycle management (ILM), and query aggregation optimization.', 3, 51),
  ('5eed0000-0000-0000-0000-00000000a252'::uuid, 'SKL-SEC-02', 'OWASP Top 10 Mitigation & AppSec', 'security', 'Mitigating SQL injection, Cross-Site Scripting (XSS), CSRF tokens, SSRF sanitization, and automated SAST/DAST checks in CI.', 3, 52),
  ('5eed0000-0000-0000-0000-00000000a253'::uuid, 'SKL-SEC-03', 'Threat Modeling & STRIDE Methodology', 'security', 'Architectural threat modeling, data flow diagrams (DFD), STRIDE threat categorization, and DREAD risk scoring.', 3, 53),
  ('5eed0000-0000-0000-0000-00000000a254'::uuid, 'SKL-SEC-04', 'Identity & Access Management (OAuth2, OIDC & PKCE)', 'security', 'OAuth 2.1 authorization code flow with PKCE, JWT signature validation, token refresh rotation, and session management.', 3, 54),
  ('5eed0000-0000-0000-0000-00000000a255'::uuid, 'SKL-SEC-05', 'Cryptography & Secret Management (Vault)', 'security', 'Envelope encryption, TLS 1.3 configuration, HashiCorp Vault dynamic database secrets, and automated key rotation.', 3, 55),
  ('5eed0000-0000-0000-0000-00000000a256'::uuid, 'SKL-SEC-06', 'Zero Trust Architecture & Network Security', 'security', 'Software-defined perimeters, mutual TLS (mTLS) service mesh, micro-segmentation, and IP egress filtering.', 3, 56),
  ('5eed0000-0000-0000-0000-00000000a257'::uuid, 'SKL-EMB-01', 'C/C++ Systems & Embedded Programming', 'embedded', 'Memory constraints, volatile variables, bit manipulation, bare-metal microcontroller register programming, and pointer safety.', 3, 57),
  ('5eed0000-0000-0000-0000-00000000a258'::uuid, 'SKL-EMB-02', 'Real-Time Operating Systems (FreeRTOS & Zephyr)', 'embedded', 'Preemptive task scheduling, semaphores, message queues, priority inversion remediation, and tickless idle power management.', 3, 58),
  ('5eed0000-0000-0000-0000-00000000a259'::uuid, 'SKL-EMB-03', 'Hardware Communication (UART, SPI, I2C, CAN)', 'embedded', 'Serial protocols, clock polarity/phase (CPOL/CPHA), DMA burst transfers, CRC checksum verification, and logic analyzer debugging.', 3, 59),
  ('5eed0000-0000-0000-0000-00000000a260'::uuid, 'SKL-EMB-04', 'IoT Protocols & Edge Telemetry (MQTT & BLE)', 'embedded', 'MQTT QoS levels (0, 1, 2), topic hierarchy, retained messages, Bluetooth Low Energy (BLE) GATT services, and payload compression.', 3, 60),
  ('5eed0000-0000-0000-0000-00000000a261'::uuid, 'SKL-EMB-05', 'Embedded Security & Secure Bootloaders', 'embedded', 'Hardware Root of Trust, cryptographic firmware image verification, MCUboot rollback protection, and encrypted flash memory.', 3, 61),
  ('5eed0000-0000-0000-0000-00000000a262'::uuid, 'SKL-LEA-02', 'Architecture Decision Proposals (ADR) & RFCs', 'leadership', 'Formulating architectural RFC proposals, trade-off analysis, cross-team consensus building, and technical documentation.', 3, 62),
  ('5eed0000-0000-0000-0000-00000000a263'::uuid, 'SKL-LEA-03', 'Agile Estimation & Engineering Roadmapping', 'leadership', 'Story point calibration, sprint capacity budgeting, risk mitigation, and translating business roadmap into engineering epics.', 3, 63),
  ('5eed0000-0000-0000-0000-00000000a264'::uuid, 'SKL-LEA-04', 'Cross-Functional & Stakeholder Communication', 'leadership', 'Communicating technical debt and architectural trade-offs to business executives, product managers, and external clients.', 3, 64),
  ('5eed0000-0000-0000-0000-00000000a265'::uuid, 'SKL-LEA-05', 'Engineering Hiring & Technical Interviewing', 'leadership', 'System design interviewing rubrics, coding assessments, structured behavioral evaluation, and interviewer calibration.', 3, 65),
  ('5eed0000-0000-0000-0000-0000dc340001'::uuid, 'DC34-001', 'Python', 'backend', 'Python as a whole, from the DC34 skill matrix (Programming Language).', 3, 66),
  ('5eed0000-0000-0000-0000-0000dc340003'::uuid, 'DC34-003', 'Tornado', 'backend', 'Part of Python in the DC34 skill matrix (Programming Language).', 3, 67),
  ('5eed0000-0000-0000-0000-0000dc340004'::uuid, 'DC34-004', 'Flask', 'backend', 'Part of Python in the DC34 skill matrix (Programming Language).', 3, 68),
  ('5eed0000-0000-0000-0000-0000dc340006'::uuid, 'DC34-006', 'Java', 'backend', 'Java as a whole, from the DC34 skill matrix (Programming Language).', 3, 69),
  ('5eed0000-0000-0000-0000-0000dc340008'::uuid, 'DC34-008', 'Hibernate', 'backend', 'Part of Java in the DC34 skill matrix (Programming Language).', 3, 70),
  ('5eed0000-0000-0000-0000-0000dc340009'::uuid, 'DC34-009', 'Struts', 'backend', 'Part of Java in the DC34 skill matrix (Programming Language).', 3, 71),
  ('5eed0000-0000-0000-0000-0000dc340010'::uuid, 'DC34-010', 'Java Core', 'backend', 'Part of Java in the DC34 skill matrix (Programming Language).', 3, 72),
  ('5eed0000-0000-0000-0000-0000dc340012'::uuid, 'DC34-012', 'JavaScript/Typescript', 'frontend', 'JavaScript/Typescript as a whole, from the DC34 skill matrix (Programming Language).', 3, 73),
  ('5eed0000-0000-0000-0000-0000dc340013'::uuid, 'DC34-013', 'ExpressJs', 'backend', 'Part of JavaScript/Typescript in the DC34 skill matrix (Programming Language).', 3, 74),
  ('5eed0000-0000-0000-0000-0000dc340014'::uuid, 'DC34-014', 'AdonisJS', 'backend', 'Part of JavaScript/Typescript in the DC34 skill matrix (Programming Language).', 3, 75),
  ('5eed0000-0000-0000-0000-0000dc340015'::uuid, 'DC34-015', 'Angular', 'frontend', 'Part of JavaScript/Typescript in the DC34 skill matrix (Programming Language).', 3, 76),
  ('5eed0000-0000-0000-0000-0000dc340019'::uuid, 'DC34-019', 'ThreeJs', 'frontend', 'Part of JavaScript/Typescript in the DC34 skill matrix (Programming Language).', 3, 77),
  ('5eed0000-0000-0000-0000-0000dc340022'::uuid, 'DC34-022', 'PHP', 'backend', 'PHP as a whole, from the DC34 skill matrix (Programming Language).', 3, 78),
  ('5eed0000-0000-0000-0000-0000dc340023'::uuid, 'DC34-023', 'Laravel', 'backend', 'Part of PHP in the DC34 skill matrix (Programming Language).', 3, 79),
  ('5eed0000-0000-0000-0000-0000dc340024'::uuid, 'DC34-024', 'Symfony', 'backend', 'Part of PHP in the DC34 skill matrix (Programming Language).', 3, 80),
  ('5eed0000-0000-0000-0000-0000dc340025'::uuid, 'DC34-025', 'CakePHP', 'backend', 'Part of PHP in the DC34 skill matrix (Programming Language).', 3, 81),
  ('5eed0000-0000-0000-0000-0000dc340026'::uuid, 'DC34-026', 'FuelPHP', 'backend', 'Part of PHP in the DC34 skill matrix (Programming Language).', 3, 82),
  ('5eed0000-0000-0000-0000-0000dc340028'::uuid, 'DC34-028', 'C', 'embedded', 'Part of C/C++ in the DC34 skill matrix (Programming Language).', 3, 83),
  ('5eed0000-0000-0000-0000-0000dc340029'::uuid, 'DC34-029', 'C++', 'embedded', 'Part of C/C++ in the DC34 skill matrix (Programming Language).', 3, 84),
  ('5eed0000-0000-0000-0000-0000dc340030'::uuid, 'DC34-030', 'C#', 'backend', 'C# as a whole, from the DC34 skill matrix (Programming Language).', 3, 85),
  ('5eed0000-0000-0000-0000-0000dc340031'::uuid, 'DC34-031', 'ASP.NET', 'backend', 'Part of C# in the DC34 skill matrix (Programming Language).', 3, 86),
  ('5eed0000-0000-0000-0000-0000dc340033'::uuid, 'DC34-033', 'Rust', 'backend', 'Rust as a whole, from the DC34 skill matrix (Programming Language).', 3, 87),
  ('5eed0000-0000-0000-0000-0000dc340034'::uuid, 'DC34-034', 'Rocket', 'backend', 'Part of Rust in the DC34 skill matrix (Programming Language).', 3, 88),
  ('5eed0000-0000-0000-0000-0000dc340035'::uuid, 'DC34-035', 'Actix', 'backend', 'Part of Rust in the DC34 skill matrix (Programming Language).', 3, 89),
  ('5eed0000-0000-0000-0000-0000dc340037'::uuid, 'DC34-037', 'Loco', 'backend', 'Part of Rust in the DC34 skill matrix (Programming Language).', 3, 90),
  ('5eed0000-0000-0000-0000-0000dc340039'::uuid, 'DC34-039', 'Gin', 'backend', 'Part of Golang in the DC34 skill matrix (Programming Language).', 3, 91),
  ('5eed0000-0000-0000-0000-0000dc340040'::uuid, 'DC34-040', 'Echo', 'backend', 'Part of Golang in the DC34 skill matrix (Programming Language).', 3, 92),
  ('5eed0000-0000-0000-0000-0000dc340041'::uuid, 'DC34-041', 'Beego', 'backend', 'Part of Golang in the DC34 skill matrix (Programming Language).', 3, 93),
  ('5eed0000-0000-0000-0000-0000dc340042'::uuid, 'DC34-042', 'Fiber', 'backend', 'Part of Golang in the DC34 skill matrix (Programming Language).', 3, 94),
  ('5eed0000-0000-0000-0000-0000dc340043'::uuid, 'DC34-043', 'Scripting', 'devops', 'Scripting as a whole, from the DC34 skill matrix (Programming Language).', 3, 95),
  ('5eed0000-0000-0000-0000-0000dc340046'::uuid, 'DC34-046', 'PowerShell', 'devops', 'Part of Scripting in the DC34 skill matrix (Programming Language).', 3, 96),
  ('5eed0000-0000-0000-0000-0000dc340047'::uuid, 'DC34-047', 'Perl', 'devops', 'Part of Scripting in the DC34 skill matrix (Programming Language).', 3, 97),
  ('5eed0000-0000-0000-0000-0000dc340048'::uuid, 'DC34-048', 'Groovy', 'devops', 'Part of Scripting in the DC34 skill matrix (Programming Language).', 3, 98),
  ('5eed0000-0000-0000-0000-0000dc340049'::uuid, 'DC34-049', 'Ansible', 'devops', 'Part of Scripting in the DC34 skill matrix (Programming Language).', 3, 99),
  ('5eed0000-0000-0000-0000-0000dc340050'::uuid, 'DC34-050', 'HTML/CSS', 'frontend', 'HTML/CSS as a whole, from the DC34 skill matrix (Programming Language).', 3, 100),
  ('5eed0000-0000-0000-0000-0000dc340051'::uuid, 'DC34-051', 'HTML', 'frontend', 'Part of HTML/CSS in the DC34 skill matrix (Programming Language).', 3, 101),
  ('5eed0000-0000-0000-0000-0000dc340052'::uuid, 'DC34-052', 'CSS', 'frontend', 'Part of HTML/CSS in the DC34 skill matrix (Programming Language).', 3, 102),
  ('5eed0000-0000-0000-0000-0000dc340056'::uuid, 'DC34-056', 'Ruby', 'backend', 'Ruby as a whole, from the DC34 skill matrix (Programming Language).', 3, 103),
  ('5eed0000-0000-0000-0000-0000dc340057'::uuid, 'DC34-057', 'Ruby on Rails', 'backend', 'Part of Ruby in the DC34 skill matrix (Programming Language).', 3, 104),
  ('5eed0000-0000-0000-0000-0000dc340058'::uuid, 'DC34-058', 'Sinatra', 'backend', 'Part of Ruby in the DC34 skill matrix (Programming Language).', 3, 105),
  ('5eed0000-0000-0000-0000-0000dc340059'::uuid, 'DC34-059', 'Camping', 'backend', 'Part of Ruby in the DC34 skill matrix (Programming Language).', 3, 106),
  ('5eed0000-0000-0000-0000-0000dc340064'::uuid, 'DC34-064', 'Objective-C', 'mobile', 'Objective-C as a whole, from the DC34 skill matrix (Programming Language).', 3, 107),
  ('5eed0000-0000-0000-0000-0000dc340069'::uuid, 'DC34-069', 'Websocket', 'backend', 'Part of API in the DC34 skill matrix (Backend).', 3, 108),
  ('5eed0000-0000-0000-0000-0000dc340070'::uuid, 'DC34-070', 'Caching', 'backend', 'Caching as a whole, from the DC34 skill matrix (Backend).', 3, 109),
  ('5eed0000-0000-0000-0000-0000dc340072'::uuid, 'DC34-072', 'Memcached', 'backend', 'Part of Caching in the DC34 skill matrix (Backend).', 3, 110),
  ('5eed0000-0000-0000-0000-0000dc340073'::uuid, 'DC34-073', 'Database', 'backend', 'Database as a whole, from the DC34 skill matrix (Backend).', 3, 111),
  ('5eed0000-0000-0000-0000-0000dc340074'::uuid, 'DC34-074', 'MySQL', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 112),
  ('5eed0000-0000-0000-0000-0000dc340076'::uuid, 'DC34-076', 'SQLite', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 113),
  ('5eed0000-0000-0000-0000-0000dc340078'::uuid, 'DC34-078', 'MariaDB', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 114),
  ('5eed0000-0000-0000-0000-0000dc340080'::uuid, 'DC34-080', 'Oracle', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 115),
  ('5eed0000-0000-0000-0000-0000dc340081'::uuid, 'DC34-081', 'Cassandra', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 116),
  ('5eed0000-0000-0000-0000-0000dc340082'::uuid, 'DC34-082', 'Neo4j', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 117),
  ('5eed0000-0000-0000-0000-0000dc340083'::uuid, 'DC34-083', 'InfluxDB', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 118),
  ('5eed0000-0000-0000-0000-0000dc340084'::uuid, 'DC34-084', 'Supabase', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 119),
  ('5eed0000-0000-0000-0000-0000dc340085'::uuid, 'DC34-085', 'Cloud Firestore', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 120),
  ('5eed0000-0000-0000-0000-0000dc340086'::uuid, 'DC34-086', 'Firebase', 'backend', 'Part of Database in the DC34 skill matrix (Backend).', 3, 121),
  ('5eed0000-0000-0000-0000-0000dc340087'::uuid, 'DC34-087', 'Security', 'security', 'Security as a whole, from the DC34 skill matrix (Backend).', 3, 122),
  ('5eed0000-0000-0000-0000-0000dc340089'::uuid, 'DC34-089', 'JWT', 'security', 'Part of Security in the DC34 skill matrix (Backend).', 3, 123),
  ('5eed0000-0000-0000-0000-0000dc340091'::uuid, 'DC34-091', 'Version Control', 'devops', 'Version Control as a whole, from the DC34 skill matrix (Backend).', 3, 124),
  ('5eed0000-0000-0000-0000-0000dc340092'::uuid, 'DC34-092', 'Git', 'devops', 'Part of Version Control in the DC34 skill matrix (Backend).', 3, 125),
  ('5eed0000-0000-0000-0000-0000dc340093'::uuid, 'DC34-093', 'SVN', 'devops', 'Part of Version Control in the DC34 skill matrix (Backend).', 3, 126),
  ('5eed0000-0000-0000-0000-0000dc340094'::uuid, 'DC34-094', 'Cloud Development', 'cloud', 'Cloud Development as a whole, from the DC34 skill matrix (Backend).', 3, 127),
  ('5eed0000-0000-0000-0000-0000dc340102'::uuid, 'DC34-102', 'Microservices', 'backend', 'Part of System Design in the DC34 skill matrix (Backend).', 3, 128),
  ('5eed0000-0000-0000-0000-0000dc340103'::uuid, 'DC34-103', 'Load balancing', 'backend', 'Part of System Design in the DC34 skill matrix (Backend).', 3, 129),
  ('5eed0000-0000-0000-0000-0000dc340104'::uuid, 'DC34-104', 'Fault Tolerance', 'backend', 'Part of System Design in the DC34 skill matrix (Backend).', 3, 130),
  ('5eed0000-0000-0000-0000-0000dc340105'::uuid, 'DC34-105', 'Message Broker', 'backend', 'Message Broker as a whole, from the DC34 skill matrix (Backend).', 3, 131),
  ('5eed0000-0000-0000-0000-0000dc340107'::uuid, 'DC34-107', 'RabbitMQ', 'backend', 'Part of Message Broker in the DC34 skill matrix (Backend).', 3, 132),
  ('5eed0000-0000-0000-0000-0000dc340108'::uuid, 'DC34-108', 'ZeroMQ', 'backend', 'Part of Message Broker in the DC34 skill matrix (Backend).', 3, 133),
  ('5eed0000-0000-0000-0000-0000dc340117'::uuid, 'DC34-117', 'API Tool', 'backend', 'API Tool as a whole, from the DC34 skill matrix (Backend).', 3, 134),
  ('5eed0000-0000-0000-0000-0000dc340118'::uuid, 'DC34-118', 'Postman', 'backend', 'Part of API Tool in the DC34 skill matrix (Backend).', 3, 135),
  ('5eed0000-0000-0000-0000-0000dc340119'::uuid, 'DC34-119', 'Swagger', 'backend', 'Part of API Tool in the DC34 skill matrix (Backend).', 3, 136),
  ('5eed0000-0000-0000-0000-0000dc340120'::uuid, 'DC34-120', 'SoapUI', 'backend', 'Part of API Tool in the DC34 skill matrix (Backend).', 3, 137),
  ('5eed0000-0000-0000-0000-0000dc340121'::uuid, 'DC34-121', 'jMetter', 'backend', 'Part of API Tool in the DC34 skill matrix (Backend).', 3, 138),
  ('5eed0000-0000-0000-0000-0000dc340123'::uuid, 'DC34-123', 'Jenkins', 'devops', 'Part of CI/CD in the DC34 skill matrix (Backend).', 3, 139),
  ('5eed0000-0000-0000-0000-0000dc340124'::uuid, 'DC34-124', 'Gitlab CI', 'devops', 'Part of CI/CD in the DC34 skill matrix (Backend).', 3, 140),
  ('5eed0000-0000-0000-0000-0000dc340125'::uuid, 'DC34-125', 'TeamCity', 'devops', 'Part of CI/CD in the DC34 skill matrix (Backend).', 3, 141),
  ('5eed0000-0000-0000-0000-0000dc340126'::uuid, 'DC34-126', 'Github Workflow', 'devops', 'Part of CI/CD in the DC34 skill matrix (Backend).', 3, 142),
  ('5eed0000-0000-0000-0000-0000dc340127'::uuid, 'DC34-127', 'Octopus', 'devops', 'Part of CI/CD in the DC34 skill matrix (Backend).', 3, 143),
  ('5eed0000-0000-0000-0000-0000dc340131'::uuid, 'DC34-131', 'Loki', 'devops', 'Part of Monitoring, Logging, Dashboard in the DC34 skill matrix (Backend).', 3, 144),
  ('5eed0000-0000-0000-0000-0000dc340132'::uuid, 'DC34-132', 'Soft skill', 'leadership', 'Soft skill as a whole, from the DC34 skill matrix (Backend).', 3, 145),
  ('5eed0000-0000-0000-0000-0000dc340133'::uuid, 'DC34-133', 'Problem-solving', 'leadership', 'Part of Soft skill in the DC34 skill matrix (Backend).', 3, 146),
  ('5eed0000-0000-0000-0000-0000dc340134'::uuid, 'DC34-134', 'Critical thinking', 'leadership', 'Part of Soft skill in the DC34 skill matrix (Backend).', 3, 147),
  ('5eed0000-0000-0000-0000-0000dc340135'::uuid, 'DC34-135', 'Design patterns', 'leadership', 'Part of Soft skill in the DC34 skill matrix (Backend).', 3, 148),
  ('5eed0000-0000-0000-0000-0000dc340136'::uuid, 'DC34-136', 'Data Structures and Algorithms', 'leadership', 'Part of Soft skill in the DC34 skill matrix (Backend).', 3, 149),
  ('5eed0000-0000-0000-0000-0000dc340137'::uuid, 'DC34-137', 'Javascript', 'frontend', 'Javascript as a whole, from the DC34 skill matrix (Web Frontend).', 3, 150),
  ('5eed0000-0000-0000-0000-0000dc340138'::uuid, 'DC34-138', 'ES5', 'frontend', 'Part of Javascript in the DC34 skill matrix (Web Frontend).', 3, 151),
  ('5eed0000-0000-0000-0000-0000dc340139'::uuid, 'DC34-139', 'ES6', 'frontend', 'Part of Javascript in the DC34 skill matrix (Web Frontend).', 3, 152),
  ('5eed0000-0000-0000-0000-0000dc340141'::uuid, 'DC34-141', 'Bootstrap', 'frontend', 'Part of CSS in the DC34 skill matrix (Web Frontend).', 3, 153),
  ('5eed0000-0000-0000-0000-0000dc340143'::uuid, 'DC34-143', 'SASS/SCSS', 'frontend', 'Part of CSS in the DC34 skill matrix (Web Frontend).', 3, 154),
  ('5eed0000-0000-0000-0000-0000dc340144'::uuid, 'DC34-144', 'Markup Languages', 'frontend', 'Markup Languages as a whole, from the DC34 skill matrix (Web Frontend).', 3, 155),
  ('5eed0000-0000-0000-0000-0000dc340146'::uuid, 'DC34-146', 'XML', 'frontend', 'Part of Markup Languages in the DC34 skill matrix (Web Frontend).', 3, 156),
  ('5eed0000-0000-0000-0000-0000dc340147'::uuid, 'DC34-147', 'SVG', 'frontend', 'Part of Markup Languages in the DC34 skill matrix (Web Frontend).', 3, 157),
  ('5eed0000-0000-0000-0000-0000dc340148'::uuid, 'DC34-148', 'MathML', 'frontend', 'Part of Markup Languages in the DC34 skill matrix (Web Frontend).', 3, 158),
  ('5eed0000-0000-0000-0000-0000dc340149'::uuid, 'DC34-149', 'Design & UI/UX', 'frontend', 'Design & UI/UX as a whole, from the DC34 skill matrix (Web Frontend).', 3, 159),
  ('5eed0000-0000-0000-0000-0000dc340150'::uuid, 'DC34-150', 'Figma', 'frontend', 'Part of Design & UI/UX in the DC34 skill matrix (Web Frontend).', 3, 160),
  ('5eed0000-0000-0000-0000-0000dc340151'::uuid, 'DC34-151', 'Canvas', 'frontend', 'Part of Design & UI/UX in the DC34 skill matrix (Web Frontend).', 3, 161),
  ('5eed0000-0000-0000-0000-0000dc340152'::uuid, 'DC34-152', 'Sketch', 'frontend', 'Part of Design & UI/UX in the DC34 skill matrix (Web Frontend).', 3, 162),
  ('5eed0000-0000-0000-0000-0000dc340153'::uuid, 'DC34-153', 'Wireframe', 'frontend', 'Part of Design & UI/UX in the DC34 skill matrix (Web Frontend).', 3, 163),
  ('5eed0000-0000-0000-0000-0000dc340154'::uuid, 'DC34-154', 'Data Exchange & API Integration', 'frontend', 'Data Exchange & API Integration as a whole, from the DC34 skill matrix (Web Frontend).', 3, 164),
  ('5eed0000-0000-0000-0000-0000dc340162'::uuid, 'DC34-162', 'SEO', 'frontend', 'Part of Core Web Vitals Assessment in the DC34 skill matrix (Web Frontend).', 3, 165),
  ('5eed0000-0000-0000-0000-0000dc340163'::uuid, 'DC34-163', 'Responsive & Mobile First', 'frontend', 'Part of Core Web Vitals Assessment in the DC34 skill matrix (Web Frontend).', 3, 166),
  ('5eed0000-0000-0000-0000-0000dc340164'::uuid, 'DC34-164', 'Browser Expertise', 'frontend', 'Browser Expertise as a whole, from the DC34 skill matrix (Web Frontend).', 3, 167),
  ('5eed0000-0000-0000-0000-0000dc340165'::uuid, 'DC34-165', 'Developer tools', 'frontend', 'Part of Browser Expertise in the DC34 skill matrix (Web Frontend).', 3, 168),
  ('5eed0000-0000-0000-0000-0000dc340166'::uuid, 'DC34-166', 'Storages', 'frontend', 'Part of Browser Expertise in the DC34 skill matrix (Web Frontend).', 3, 169),
  ('5eed0000-0000-0000-0000-0000dc340167'::uuid, 'DC34-167', 'Cookies', 'frontend', 'Part of Browser Expertise in the DC34 skill matrix (Web Frontend).', 3, 170),
  ('5eed0000-0000-0000-0000-0000dc340168'::uuid, 'DC34-168', 'Background Services', 'frontend', 'Part of Browser Expertise in the DC34 skill matrix (Web Frontend).', 3, 171),
  ('5eed0000-0000-0000-0000-0000dc340169'::uuid, 'DC34-169', 'Service workers', 'frontend', 'Part of Browser Expertise in the DC34 skill matrix (Web Frontend).', 3, 172),
  ('5eed0000-0000-0000-0000-0000dc340179'::uuid, 'DC34-179', 'Web server', 'devops', 'Web server as a whole, from the DC34 skill matrix (Web Frontend).', 3, 173),
  ('5eed0000-0000-0000-0000-0000dc340180'::uuid, 'DC34-180', 'NGINX', 'devops', 'Part of Web server in the DC34 skill matrix (Web Frontend).', 3, 174),
  ('5eed0000-0000-0000-0000-0000dc340181'::uuid, 'DC34-181', 'Apache Tomcat', 'devops', 'Part of Web server in the DC34 skill matrix (Web Frontend).', 3, 175),
  ('5eed0000-0000-0000-0000-0000dc340182'::uuid, 'DC34-182', 'MS IIS', 'devops', 'Part of Web server in the DC34 skill matrix (Web Frontend).', 3, 176),
  ('5eed0000-0000-0000-0000-0000dc340184'::uuid, 'DC34-184', 'Modularity', 'frontend', 'Part of System Design in the DC34 skill matrix (Web Frontend).', 3, 177),
  ('5eed0000-0000-0000-0000-0000dc340185'::uuid, 'DC34-185', 'Micro Frontend', 'frontend', 'Part of System Design in the DC34 skill matrix (Web Frontend).', 3, 178),
  ('5eed0000-0000-0000-0000-0000dc340186'::uuid, 'DC34-186', 'Share Components', 'frontend', 'Part of System Design in the DC34 skill matrix (Web Frontend).', 3, 179),
  ('5eed0000-0000-0000-0000-0000dc340207'::uuid, 'DC34-207', 'Content Security Policy (CSP)', 'security', 'Part of Security in the DC34 skill matrix (Web Frontend).', 3, 180),
  ('5eed0000-0000-0000-0000-0000dc340208'::uuid, 'DC34-208', 'Cookies and Storages', 'security', 'Part of Security in the DC34 skill matrix (Web Frontend).', 3, 181),
  ('5eed0000-0000-0000-0000-0000dc340209'::uuid, 'DC34-209', 'Input validation', 'security', 'Part of Security in the DC34 skill matrix (Web Frontend).', 3, 182)
) as v (id, code, name, domain_slug, description, benchmark_level, sort_order)
on conflict do nothing;

-- 3. member_skills schema: numeric(4,1) YoE, 'returned' status, and review_note rules.
alter table public.member_skills
  drop constraint if exists member_skills_years_of_experience_check,
  alter column years_of_experience type numeric(4, 1) using years_of_experience::numeric(4, 1),
  alter column years_of_experience set default 0,
  add constraint member_skills_years_of_experience_check
    check (years_of_experience >= 0 and years_of_experience <= 50);

alter table public.member_skills
  drop constraint if exists member_skills_verification_status_check,
  add constraint member_skills_verification_status_check
    check (verification_status in ('certified', 'self_assessed', 'pending_review', 'returned'));

alter table public.member_skills
  add column if not exists review_note text
    check (review_note is null or length(review_note) <= 1000);

alter table public.member_skills
  drop constraint if exists member_skills_review_note_rules,
  add constraint member_skills_review_note_rules
    check (
      (verification_status = 'returned' and coalesce(btrim(review_note), '') <> '')
      or (verification_status is distinct from 'returned' and review_note is null)
    );

-- 4. RLS policies (explicit WITH CHECK on UPDATE, new DELETE policy) and grants.
drop policy if exists "member_skills: update own or managed" on public.member_skills;
create policy "member_skills: update own or managed" on public.member_skills
  for update to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  )
  with check (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );

drop policy if exists "member_skills: delete own or managed" on public.member_skills;
create policy "member_skills: delete own or managed" on public.member_skills
  for delete to authenticated
  using (
    member_id = (select public.my_member_id())
    or member_id in (select public.managed_member_ids())
  );

revoke all on public.skill_domains, public.skills, public.skill_certificate_links, public.member_skills from anon;
grant select on public.skill_domains, public.skills, public.skill_certificate_links to authenticated;
grant select, insert, update, delete on public.member_skills to authenticated;

-- 5. Column & review workflow guards (BEFORE INSERT OR UPDATE).
create or replace function public.member_skills_review_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.app_role();
  v_my_member_id uuid := public.my_member_id();
begin
  -- Migrations, seed.sql, and superuser / pgTAP trusted setup have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  -- Row identity (member_id, skill_id) is immutable on UPDATE for all authenticated callers.
  if tg_op = 'UPDATE' then
    if new.member_id is distinct from old.member_id
       or new.skill_id is distinct from old.skill_id then
      raise exception 'member_id and skill_id cannot be changed' using errcode = '42501';
    end if;
  end if;

  -- Self-rating branch: members, or managers acting on their own row.
  if v_role is distinct from 'admin'
     and (v_role is distinct from 'manager' or new.member_id is not distinct from v_my_member_id) then
    if tg_op = 'INSERT' then
      if new.verification_status in ('certified', 'returned')
         or new.reviewed_by is not null
         or new.reviewed_at is not null
         or new.review_note is not null then
        raise exception 'you cannot certify or review your own skill' using errcode = '42501';
      end if;

      if new.current_level = 5 then
        new.verification_status := 'pending_review';
        new.manager_endorsement_requested := true;
      else
        new.verification_status := 'self_assessed';
        new.manager_endorsement_requested := false;
      end if;

      return new;
    end if;

    -- UPDATE in self-rating branch
    if new.verification_status in ('certified', 'returned')
       and new.verification_status is distinct from old.verification_status then
      raise exception 'you cannot certify or review your own skill' using errcode = '42501';
    end if;

    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.review_note is distinct from old.review_note then
      raise exception 'you cannot modify review fields on your own skill' using errcode = '42501';
    end if;

    if new.current_level is distinct from old.current_level
       or old.verification_status = 'returned' then
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
      if new.current_level = 5 then
        new.verification_status := 'pending_review';
        new.manager_endorsement_requested := true;
      else
        new.verification_status := 'self_assessed';
        new.manager_endorsement_requested := false;
      end if;
    elsif old.verification_status = 'certified' then
      -- Preserve an already-endorsed status when editing notes or YoE without changing level.
      new.verification_status := 'certified';
      new.manager_endorsement_requested := false;
    elsif new.current_level = 5 then
      new.verification_status := 'pending_review';
      new.manager_endorsement_requested := true;
    else
      new.verification_status := 'self_assessed';
      new.manager_endorsement_requested := false;
    end if;

    return new;
  end if;

  -- Reviewer branch: admin, or manager acting on another member's row in scope.
  if new.verification_status = 'certified' then
    new.manager_endorsement_requested := false;
    new.review_note := null;
    if tg_op = 'INSERT' then
      new.reviewed_by := coalesce(new.reviewed_by, v_my_member_id);
      new.reviewed_at := coalesce(new.reviewed_at, now());
    else
      if new.verification_status is distinct from old.verification_status then
        if new.reviewed_by is not distinct from old.reviewed_by then
          new.reviewed_by := v_my_member_id;
        end if;
        if new.reviewed_at is not distinct from old.reviewed_at then
          new.reviewed_at := now();
        end if;
      else
        new.reviewed_by := coalesce(new.reviewed_by, v_my_member_id);
        new.reviewed_at := coalesce(new.reviewed_at, now());
      end if;
    end if;
  elsif new.verification_status = 'returned' then
    new.manager_endorsement_requested := false;
    if tg_op = 'INSERT' then
      new.current_level := least(coalesce(new.current_level, 4), 4);
      new.reviewed_by := coalesce(new.reviewed_by, v_my_member_id);
      new.reviewed_at := coalesce(new.reviewed_at, now());
    else
      new.current_level := least(coalesce(new.current_level, old.current_level, 4), 4);
      if new.verification_status is distinct from old.verification_status then
        if new.reviewed_by is not distinct from old.reviewed_by then
          new.reviewed_by := v_my_member_id;
        end if;
        if new.reviewed_at is not distinct from old.reviewed_at then
          new.reviewed_at := now();
        end if;
      else
        new.reviewed_by := coalesce(new.reviewed_by, v_my_member_id);
        new.reviewed_at := coalesce(new.reviewed_at, now());
      end if;
    end if;
  else
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.manager_endorsement_requested := (new.verification_status = 'pending_review' and new.current_level = 5);
  end if;

  return new;
end;
$$;

-- 6. Realtime: subscribe /skills to member_skills changes (guarded if publication exists).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'member_skills'
     ) then
    alter publication supabase_realtime add table public.member_skills;
  end if;
end
$$;
