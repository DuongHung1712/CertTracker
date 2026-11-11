-- Certificate and course catalogue for a new environment. Not a migration and not seed.sql: run it once by hand (docs/deploy/accounts-and-catalogue.md).
-- Loads 53 exam certificates, 37 courses that carry a verified exam fee, 14 preparation courses (Microsoft Learn, Linux Foundation, HashiCorp,
-- Python Institute, Google Cloud) and 8 course completions, each with the course that grants it. A certificate is only for something you pass
-- an exam for: what you earn by finishing a course is a completion (the Meta professional certificates are courses, so they are completions).
-- Matches by name, so existing types and providers are reused. Running it again adds nothing and never overwrites a row the admin edited.
-- Every value was read on the provider's own page (exams 2026-11-05, courses and completions 2026-11-11); sources and open gaps are in
-- supabase/catalog/SOURCES.md. An empty cost, duration or validity means the page did not state it.

insert into public.cert_types (name) values
  ('AI & Machine Learning'),
  ('Agile & Project Management'),
  ('Backend Development'),
  ('Cloud'),
  ('Data & Analytics'),
  ('DevOps & Containers'),
  ('Frontend Development'),
  ('Languages & Soft Skills'),
  ('Networking'),
  ('Security')
on conflict (name) do nothing;

insert into public.providers (name) values
  ('AWS'),
  ('Microsoft'),
  ('Google Cloud'),
  ('Linux Foundation'),
  ('HashiCorp'),
  ('NVIDIA'),
  ('Cisco'),
  ('CompTIA'),
  ('Databricks'),
  ('GitHub'),
  ('Scrum.org'),
  ('PMI'),
  ('Oracle'),
  ('VMware Tanzu (Spring)'),
  ('Certificates.dev'),
  ('Meta'),
  ('Python Institute'),
  ('British Council & IDP'),
  ('ETS (IIG Vietnam)'),
  ('ETS'),
  ('Japan Foundation (JEES)'),
  ('NIIED (Korea)'),
  ('Chinese Testing International (CLEC)'),
  ('Google'),
  ('IBM'),
  ('DeepLearning.AI')
on conflict (name) do nothing;

-- The exam list is read twice: for the certificates and for the courses that carry the exam fee.
drop table if exists catalogue_exams;
create temporary table catalogue_exams as
select * from (values
  ('AWS Certified Solutions Architect - Associate', 'Cloud', 'AWS', 'Associate'::text, 36::int, true, 150::numeric, 'USD'::text, 'https://aws.amazon.com/certification/certified-solutions-architect-associate/'),
  ('AWS Certified Cloud Practitioner', 'Cloud', 'AWS', 'Foundational', 36, true, 100, 'USD', 'https://aws.amazon.com/certification/certified-cloud-practitioner/'),
  ('AWS Certified Developer - Associate', 'Cloud', 'AWS', 'Associate', 36, true, 150, 'USD', 'https://aws.amazon.com/certification/certified-developer-associate/'),
  ('AWS Certified Solutions Architect - Professional', 'Cloud', 'AWS', 'Professional', 36, true, 300, 'USD', 'https://aws.amazon.com/certification/certified-solutions-architect-professional/'),
  ('AWS Certified DevOps Engineer - Professional', 'DevOps & Containers', 'AWS', 'Professional', 36, true, 300, 'USD', 'https://aws.amazon.com/certification/certified-devops-engineer-professional/'),
  ('AWS Certified Security - Specialty', 'Security', 'AWS', 'Specialty', 36, true, 300, 'USD', 'https://aws.amazon.com/certification/certified-security-specialty/'),
  ('Microsoft Certified: Azure Fundamentals (AZ-900)', 'Cloud', 'Microsoft', 'Beginner', null, true, 50, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/'),
  ('Microsoft Certified: Azure Administrator Associate (AZ-104)', 'Cloud', 'Microsoft', 'Intermediate', 12, true, 83, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/'),
  ('Microsoft Certified: Azure Solutions Architect Expert (AZ-305)', 'Cloud', 'Microsoft', 'Expert', 12, true, 83, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-solutions-architect/'),
  ('Microsoft Certified: DevOps Engineer Expert (AZ-400)', 'DevOps & Containers', 'Microsoft', 'Expert', 12, true, 83, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/devops-engineer/'),
  ('Microsoft Certified: Azure AI Fundamentals (AI-901)', 'AI & Machine Learning', 'Microsoft', 'Beginner', null, true, 50, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/azure-ai-fundamentals/'),
  ('Cloud Digital Leader', 'Cloud', 'Google Cloud', null, 36, true, 99, 'USD', 'https://cloud.google.com/learn/certification/cloud-digital-leader'),
  ('Associate Cloud Engineer', 'Cloud', 'Google Cloud', 'Associate', 36, true, 125, 'USD', 'https://cloud.google.com/learn/certification/cloud-engineer'),
  ('Professional Cloud Architect', 'Cloud', 'Google Cloud', 'Professional', 24, true, 200, 'USD', 'https://cloud.google.com/learn/certification/cloud-architect'),
  ('Professional Data Engineer', 'Data & Analytics', 'Google Cloud', 'Professional', 24, true, 200, 'USD', 'https://cloud.google.com/learn/certification/data-engineer'),
  ('Certified Kubernetes Administrator (CKA)', 'DevOps & Containers', 'Linux Foundation', 'Intermediate', 24, true, 445, 'USD', 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/'),
  ('Certified Kubernetes Application Developer (CKAD)', 'DevOps & Containers', 'Linux Foundation', 'Intermediate', 24, true, 445, 'USD', 'https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/'),
  ('Certified Kubernetes Security Specialist (CKS)', 'Security', 'Linux Foundation', null, 24, true, 445, 'USD', 'https://training.linuxfoundation.org/certification/certified-kubernetes-security-specialist-cks/'),
  ('Terraform Associate (004)', 'DevOps & Containers', 'HashiCorp', 'Associate', 24, true, 70.5, 'USD', 'https://developer.hashicorp.com/certifications/terraform-associate'),
  ('NVIDIA-Certified Associate: Generative AI LLMs (NCA-GENL)', 'AI & Machine Learning', 'NVIDIA', 'Associate', 24, false, 125, 'USD', 'https://www.nvidia.com/en-us/learn/certification/'),
  ('NVIDIA-Certified Professional: Generative AI LLMs (NCP-GENL)', 'AI & Machine Learning', 'NVIDIA', 'Professional', 24, false, 200, 'USD', 'https://www.nvidia.com/en-us/learn/certification/generative-ai-llm-professional/'),
  ('Cisco Certified Network Associate (CCNA 200-301)', 'Networking', 'Cisco', 'Associate', 36, true, 300, 'USD', 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccna/index.html'),
  ('Cisco Certified Network Professional (CCNP Enterprise)', 'Networking', 'Cisco', 'Professional', 36, true, 700, 'USD', 'https://www.cisco.com/site/us/en/learn/training-certifications/certifications/enterprise/ccnp-enterprise/index.html'),
  ('CompTIA Security+ (SY0-701)', 'Security', 'CompTIA', null, 36, true, null, null, 'https://www.comptia.org/en-us/certifications/security/'),
  ('CompTIA Network+ (N10-009)', 'Networking', 'CompTIA', null, 36, true, null, null, 'https://www.comptia.org/en-us/certifications/network/'),
  ('Databricks Certified Associate Developer for Apache Spark', 'Data & Analytics', 'Databricks', 'Associate', 24, true, 200, 'USD', 'https://www.databricks.com/learn/certification/apache-spark-developer-associate'),
  ('GitHub Actions (GH-200)', 'DevOps & Containers', 'GitHub', 'Intermediate', 24, true, 50, 'USD', 'https://learn.microsoft.com/en-us/credentials/certifications/github-actions/'),
  ('Professional Scrum Master I (PSM I)', 'Agile & Project Management', 'Scrum.org', 'Fundamental', null, true, 200, 'USD', 'https://www.scrum.org/assessments/professional-scrum-master-i-certification'),
  ('Professional Scrum Product Owner I (PSPO I)', 'Agile & Project Management', 'Scrum.org', 'Fundamental', null, true, 200, 'USD', 'https://www.scrum.org/assessments/professional-scrum-product-owner-i-certification'),
  ('Project Management Professional (PMP)', 'Agile & Project Management', 'PMI', null, 36, true, 575, 'USD', 'https://www.pmi.org/certifications/project-management-pmp'),
  ('Oracle Certified Professional: Java SE 17 Developer (1Z0-829)', 'Backend Development', 'Oracle', 'Professional', null, true, null, null, 'https://education.oracle.com/java-se-17-developer/pexam_1Z0-829'),
  ('Spring Certified Professional (2V0-72.22)', 'Backend Development', 'VMware Tanzu (Spring)', 'Professional', null, true, 250, 'USD', 'https://spring.academy/paths/spring-certified-professional-2023'),
  ('Certified Mid-Level Vue.js Developer', 'Frontend Development', 'Certificates.dev', 'Mid-Level', null, true, 220, 'USD', 'https://certificates.dev/vuejs/'),
  ('Certified Mid-Level React Developer', 'Frontend Development', 'Certificates.dev', 'Mid-Level', 36, true, null, null, 'https://certificates.dev/react/'),
  ('PCAP - Certified Associate Python Programmer', 'Backend Development', 'Python Institute', 'Associate', 60, true, null, null, 'https://pythoninstitute.org/pcap'),
  ('IELTS Academic', 'Languages & Soft Skills', 'British Council & IDP', null, 24, true, 4664000, 'VND', 'https://ielts.org'),
  ('IELTS General Training', 'Languages & Soft Skills', 'British Council & IDP', null, 24, true, 4664000, 'VND', 'https://ielts.org'),
  ('TOEIC Listening & Reading', 'Languages & Soft Skills', 'ETS (IIG Vietnam)', null, 24, true, null, null, 'https://www.ets.org/toeic'),
  ('TOEIC Speaking & Writing', 'Languages & Soft Skills', 'ETS (IIG Vietnam)', null, 24, true, null, null, 'https://www.ets.org/toeic'),
  ('TOEFL iBT', 'Languages & Soft Skills', 'ETS', null, 24, true, null, null, 'https://www.ets.org/toefl'),
  ('JLPT N1', 'Languages & Soft Skills', 'Japan Foundation (JEES)', 'N1', null, true, 680000, 'VND', 'https://www.jlpt.jp/e/'),
  ('JLPT N2', 'Languages & Soft Skills', 'Japan Foundation (JEES)', 'N2', null, true, 680000, 'VND', 'https://www.jlpt.jp/e/'),
  ('JLPT N3', 'Languages & Soft Skills', 'Japan Foundation (JEES)', 'N3', null, true, 680000, 'VND', 'https://www.jlpt.jp/e/'),
  ('JLPT N4', 'Languages & Soft Skills', 'Japan Foundation (JEES)', 'N4', null, true, 680000, 'VND', 'https://www.jlpt.jp/e/'),
  ('JLPT N5', 'Languages & Soft Skills', 'Japan Foundation (JEES)', 'N5', null, true, 680000, 'VND', 'https://www.jlpt.jp/e/'),
  ('TOPIK I', 'Languages & Soft Skills', 'NIIED (Korea)', 'Levels 1-2', 24, true, null, null, 'https://www.topik.go.kr'),
  ('TOPIK II', 'Languages & Soft Skills', 'NIIED (Korea)', 'Levels 3-6', 24, true, null, null, 'https://www.topik.go.kr'),
  ('HSK 1', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 1', 24, true, null, null, 'http://www.chinesetest.cn/'),
  ('HSK 2', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 2', 24, true, null, null, 'http://www.chinesetest.cn/'),
  ('HSK 3', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 3', 24, true, null, null, 'http://www.chinesetest.cn/'),
  ('HSK 4', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 4', 24, true, null, null, 'http://www.chinesetest.cn/'),
  ('HSK 5', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 5', 24, true, null, null, 'http://www.chinesetest.cn/'),
  ('HSK 6', 'Languages & Soft Skills', 'Chinese Testing International (CLEC)', 'Level 6', 24, true, null, null, 'http://www.chinesetest.cn/')
) as v(name, cert_type, provider, level, validity_months, refundable, cost, cost_currency, url);

insert into public.certificates (name, kind, cert_type_id, provider_id, level, validity_months, url)
select e.name, 'exam', ct.id, p.id, e.level, e.validity_months, e.url
from catalogue_exams e
join public.cert_types ct on ct.name = e.cert_type
join public.providers p on p.name = e.provider
on conflict (provider_id, name) do nothing;

-- Where the exam fee is verified it lives on a course of the same name that prepares for the exam.
insert into public.courses (name, provider_id, refundable, cost, cost_currency, url, prepares_for_id)
select e.name, p.id, e.refundable, e.cost, e.cost_currency, e.url, ce.id
from catalogue_exams e
join public.providers p on p.name = e.provider
join public.certificates ce on ce.provider_id = p.id and ce.name = e.name and ce.kind = 'exam'
where e.cost is not null
on conflict (provider_id, name) do nothing;

drop table catalogue_exams;

-- Preparation courses. A duration is whole hours (the column is an integer); a cost only where the page states one.
insert into public.courses (name, provider_id, est_hours, cost, cost_currency, url, prepares_for_id)
select v.name, p.id, v.est_hours, v.cost, v.cost_currency, v.url, ce.id
from (values
  ('Introduction to Cloud Infrastructure: Describe cloud concepts', 'Microsoft', 1::int, null::numeric, null::text, 'https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/', 'Microsoft Certified: Azure Fundamentals (AZ-900)'),
  ('Introduction to Cloud Infrastructure: Describe Azure architecture and services', 'Microsoft', 3, null, null, 'https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-azure-architecture-services/', 'Microsoft Certified: Azure Fundamentals (AZ-900)'),
  ('Introduction to Cloud Infrastructure: Describe Azure management and governance', 'Microsoft', 1, null, null, 'https://learn.microsoft.com/en-us/training/paths/describe-azure-management-governance/', 'Microsoft Certified: Azure Fundamentals (AZ-900)'),
  ('AZ-104: Manage identities and governance in Azure', 'Microsoft', 4, null, null, 'https://learn.microsoft.com/en-us/training/paths/az-104-manage-identities-governance/', 'Microsoft Certified: Azure Administrator Associate (AZ-104)'),
  ('AZ-305: Design identity, governance, and monitor solutions', 'Microsoft', 2, null, null, 'https://learn.microsoft.com/en-us/training/paths/design-identity-governance-monitor-solutions/', 'Microsoft Certified: Azure Solutions Architect Expert (AZ-305)'),
  ('AZ-400: Implement CI with Azure Pipelines and GitHub Actions', 'Microsoft', 7, null, null, 'https://learn.microsoft.com/en-us/training/paths/az-400-implement-ci-azure-pipelines-github-actions/', 'Microsoft Certified: DevOps Engineer Expert (AZ-400)'),
  ('AI concepts for developers and technology professionals', 'Microsoft', 4, null, null, 'https://learn.microsoft.com/en-us/training/paths/ai-concepts/', 'Microsoft Certified: Azure AI Fundamentals (AI-901)'),
  ('Get started with AI applications and agents on Azure', 'Microsoft', 6, null, null, 'https://learn.microsoft.com/en-us/training/paths/get-started-ai-apps-agents/', 'Microsoft Certified: Azure AI Fundamentals (AI-901)'),
  ('Kubernetes Fundamentals (LFS258)', 'Linux Foundation', 35, 299, 'USD', 'https://training.linuxfoundation.org/training/kubernetes-fundamentals/', 'Certified Kubernetes Administrator (CKA)'),
  ('Kubernetes for Developers (LFD259)', 'Linux Foundation', 35, 299, 'USD', 'https://training.linuxfoundation.org/training/kubernetes-for-developers/', 'Certified Kubernetes Application Developer (CKAD)'),
  ('Kubernetes Security Essentials (LFS260)', 'Linux Foundation', null, 299, 'USD', 'https://training.linuxfoundation.org/training/kubernetes-security-essentials-lfs260/', 'Certified Kubernetes Security Specialist (CKS)'),
  ('Prepare for the Terraform Associate 004 Certification Exam', 'HashiCorp', null, null, null, 'https://developer.hashicorp.com/terraform/tutorials/certification-003', 'Terraform Associate (004)'),
  ('Python Essentials 2', 'Python Institute', null, 0, 'USD', 'https://pythoninstitute.org/python-essentials-2', 'PCAP - Certified Associate Python Programmer'),
  ('Professional Cloud Architect Certification', 'Google Cloud', null, null, null, 'https://www.skills.google/paths/12', 'Professional Cloud Architect')
) as v(name, provider, est_hours, cost, cost_currency, url, prepares_for)
join public.providers p on p.name = v.provider
join public.certificates ce on ce.provider_id = p.id and ce.name = v.prepares_for and ce.kind = 'exam'
on conflict (provider_id, name) do nothing;

-- Course completions: the course first (a completion points at it), then the completion. No validity: none of the pages states an expiry.
insert into public.courses (name, provider_id, est_hours, url)
select v.name, p.id, v.est_hours, v.url
from (values
  ('Google Data Analytics Professional Certificate', 'Google', null::int, 'https://www.coursera.org/professional-certificates/google-data-analytics'),
  ('Google Cybersecurity Professional Certificate', 'Google', 170, 'https://www.coursera.org/professional-certificates/google-cybersecurity'),
  ('Google Project Management Professional Certificate', 'Google', null, 'https://www.coursera.org/professional-certificates/google-project-management'),
  ('IBM Data Science Professional Certificate', 'IBM', null, 'https://www.coursera.org/professional-certificates/ibm-data-science'),
  ('Deep Learning Specialization', 'DeepLearning.AI', null, 'https://www.coursera.org/specializations/deep-learning'),
  ('Machine Learning Specialization', 'DeepLearning.AI', null, 'https://www.coursera.org/specializations/machine-learning-introduction'),
  ('Meta Front-End Developer Professional Certificate', 'Meta', null, 'https://www.coursera.org/professional-certificates/meta-front-end-developer'),
  ('Meta Back-End Developer Professional Certificate', 'Meta', null, 'https://www.coursera.org/professional-certificates/meta-back-end-developer')
) as v(name, provider, est_hours, url)
join public.providers p on p.name = v.provider
on conflict (provider_id, name) do nothing;

insert into public.certificates (name, kind, cert_type_id, provider_id, level, url, course_id)
select v.name, 'completion', ct.id, p.id, v.level, v.url, co.id
from (values
  ('Google Data Analytics Professional Certificate', 'Data & Analytics', 'Google', 'Beginner'::text, 'https://www.coursera.org/professional-certificates/google-data-analytics'),
  ('Google Cybersecurity Professional Certificate', 'Security', 'Google', 'Beginner', 'https://www.coursera.org/professional-certificates/google-cybersecurity'),
  ('Google Project Management Professional Certificate', 'Agile & Project Management', 'Google', 'Beginner', 'https://www.coursera.org/professional-certificates/google-project-management'),
  ('IBM Data Science Professional Certificate', 'Data & Analytics', 'IBM', 'Beginner', 'https://www.coursera.org/professional-certificates/ibm-data-science'),
  ('Deep Learning Specialization', 'AI & Machine Learning', 'DeepLearning.AI', 'Intermediate', 'https://www.coursera.org/specializations/deep-learning'),
  ('Machine Learning Specialization', 'AI & Machine Learning', 'DeepLearning.AI', 'Beginner', 'https://www.coursera.org/specializations/machine-learning-introduction'),
  ('Meta Front-End Developer Professional Certificate', 'Frontend Development', 'Meta', 'Beginner', 'https://www.coursera.org/professional-certificates/meta-front-end-developer'),
  ('Meta Back-End Developer Professional Certificate', 'Backend Development', 'Meta', 'Beginner', 'https://www.coursera.org/professional-certificates/meta-back-end-developer')
) as v(name, cert_type, provider, level, url)
join public.cert_types ct on ct.name = v.cert_type
join public.providers p on p.name = v.provider
join public.courses co on co.provider_id = p.id and co.name = v.name
on conflict do nothing;
