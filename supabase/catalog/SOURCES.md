# Certificate and course catalogue: sources

`courses.sql` loads three things: the 53 exam certificates and their exam fees (checked 2026-11-05), 14 preparation courses and 8 course completions (checked 2026-11-11). A certificate is only for something you pass an exam for; what you earn by finishing a course is a course completion, so the two Meta professional certificates (earlier listed as exams) moved to the completions table. Fees change: check again before relying on one.

## Exam certificates and exam fees

Checked 2026-11-05 on the official pages: Microsoft, GitHub Actions, PMI and Spring directly in a browser, the rest through a summarising fetch tool. Each row is an exam certificate; where the cost is filled, a course of the same name carries the exam fee and prepares for the exam.

- **Cost** is the exam fee in the currency the vendor charges; VND only where a Vietnam organiser publishes it. Nothing was converted.
- **Empty cost** means no official figure could be read, or there is no fixed fee. The reason is in the table.
- **Empty validity** shows as *No expiry* in the app, so the two `UNVERIFIED` blanks below need a real answer.
- **Study hours** are empty for every exam-fee course: no vendor publishes a recommendation.
- **Refundable** is the company's rule, not the vendor's. It was kept from the owner's list and not checked.

| Exam certificate | Cost | Cost source | Validity (months) | Validity source |
|---|---|---|---|---|
| AWS Certified Solutions Architect - Associate | 150 USD | Exam page | 36 | Exam page |
| AWS Certified Cloud Practitioner | 100 USD | Exam page | 36 | Exam page |
| AWS Certified Developer - Associate | 150 USD | Exam page | 36 | Exam page |
| AWS Certified Solutions Architect - Professional | 300 USD | Exam page | 36 | Exam page |
| AWS Certified DevOps Engineer - Professional | 300 USD | Exam page | 36 | Exam page |
| AWS Certified Security - Specialty | 300 USD | Exam page | 36 | Exam page |
| Microsoft Certified: Azure Fundamentals (AZ-900) | 50 USD | learn.microsoft.com, country set to Vietnam, excl. tax | none | Renewal page: Fundamentals do not expire |
| Microsoft Certified: Azure Administrator Associate (AZ-104) | 83 USD | learn.microsoft.com, country set to Vietnam, excl. tax | 12 | Exam page: renewal every 12 months |
| Microsoft Certified: Azure Solutions Architect Expert (AZ-305) | 83 USD | learn.microsoft.com, country set to Vietnam, excl. tax | 12 | Renewal page: free yearly renewal, else expires |
| Microsoft Certified: DevOps Engineer Expert (AZ-400) | 83 USD | learn.microsoft.com, country set to Vietnam, excl. tax | 12 | Renewal page: free yearly renewal, else expires |
| Microsoft Certified: Azure AI Fundamentals (AI-901) | 50 USD | learn.microsoft.com, country set to Vietnam, excl. tax | none | Renewal page: Fundamentals do not expire |
| Cloud Digital Leader | 99 USD | Exam page, plus tax | 36 | Exam page |
| Associate Cloud Engineer | 125 USD | Exam page, plus tax | 36 | Exam page |
| Professional Cloud Architect | 200 USD | Exam page, plus tax | 24 | Exam page |
| Professional Data Engineer | 200 USD | Exam page, plus tax | 24 | Exam page |
| Certified Kubernetes Administrator (CKA) | 445 USD | Exam page, exam only | 24 | Exam page; policy change 2024-04-01 |
| Certified Kubernetes Application Developer (CKAD) | 445 USD | Exam page, exam only | 24 | Exam page |
| Certified Kubernetes Security Specialist (CKS) | 445 USD | Exam page, exam only | 24 | Exam page |
| Terraform Associate (004) | 70.5 USD | Exam page, plus local tax | 24 | Exam page |
| NVIDIA-Certified Associate: Generative AI LLMs (NCA-GENL) | 125 USD | Certification page | 24 | Certification FAQ |
| NVIDIA-Certified Professional: Generative AI LLMs (NCP-GENL) | 200 USD | Exam page; registration shows Coming soon | 24 | Certification FAQ |
| Cisco Certified Network Associate (CCNA 200-301) | 300 USD | Exam page | 36 | Exam page |
| Cisco Certified Network Professional (CCNP Enterprise) | 700 USD | Exam page: core ENCOR 400 plus one concentration 300 | 36 | Exam page |
| CompTIA Security+ (SY0-701) | — | UNVERIFIED: comptia.org shows no price | 36 | UNVERIFIED: 36 kept from the owner's list; CompTIA's page was not readable |
| CompTIA Network+ (N10-009) | — | UNVERIFIED: comptia.org shows no price | 36 | UNVERIFIED: 36 kept from the owner's list; CompTIA's page was not readable |
| Databricks Certified Associate Developer for Apache Spark | 200 USD | Exam page | 24 | Exam page |
| GitHub Actions (GH-200) | 50 USD | learn.microsoft.com, country set to Vietnam, excl. tax | 24 | Exam page |
| Professional Scrum Master I (PSM I) | 200 USD | Exam page, plus tax | none | Exam page: lifetime |
| Professional Scrum Product Owner I (PSPO I) | 200 USD | Exam page, plus tax | none | Exam page: lifetime |
| Project Management Professional (PMP) | 575 USD | Exam page: full price 575, PMI member 284 | 36 | Exam page: 60 PDUs every three years |
| Oracle Certified Professional: Java SE 17 Developer (1Z0-829) | — | UNVERIFIED: Oracle blocks automated reading (HTTP 403) | none | UNVERIFIED: blank in the app means no expiry; confirm with Oracle |
| Spring Certified Professional (2V0-72.22) | 250 USD | Spring Academy FAQ: VMware exam voucher | none | UNVERIFIED: not published; blank in the app means no expiry |
| Certified Mid-Level Vue.js Developer | 220 USD | Vendor page: list 220, offer 169 at the check date | none | Vendor page: certificate does not expire |
| Certified Mid-Level React Developer | — | UNVERIFIED: exam-only price on the page is ambiguous (about 169 to 179) | 36 | Vendor page: 3 years from passing |
| PCAP - Certified Associate Python Programmer | — | UNVERIFIED: fee sits in the OpenEDG store, not reachable | 60 | Exam page: 5 years |
| IELTS Academic | 4,664,000 VND | IDP Vietnam: incl. 8% VAT, valid to 2026-12-31 (https://ielts.idp.com/vietnam/ielts-fees) | 24 | ielts.org recommendation; the result has no formal expiry |
| IELTS General Training | 4,664,000 VND | IDP Vietnam: incl. 8% VAT, valid to 2026-12-31 | 24 | ielts.org recommendation; the result has no formal expiry |
| TOEIC Listening & Reading | — | UNVERIFIED: IIG's pages show no fee | 24 | ETS: scores valid for 2 years |
| TOEIC Speaking & Writing | — | UNVERIFIED: IIG's pages show no fee | 24 | ETS: scores valid for 2 years |
| TOEFL iBT | — | UNVERIFIED: the ETS fee table did not load; ETS charges by country | 24 | IIG Vietnam: valid for two years from the test date |
| JLPT N1 | 680,000 VND | EIU, July 2026 session (https://flc.eiu.edu.vn/?p=8445); plus 30,000 form and 30,000 submission fee; other cities may differ | none | jlpt.jp FAQ: certificate never expires; employers may set their own limit |
| JLPT N2 | 680,000 VND | EIU, July 2026 session (https://flc.eiu.edu.vn/?p=8445); plus 30,000 form and 30,000 submission fee; other cities may differ | none | jlpt.jp FAQ: certificate never expires; employers may set their own limit |
| JLPT N3 | 680,000 VND | EIU, July 2026 session (https://flc.eiu.edu.vn/?p=8445); plus 30,000 form and 30,000 submission fee; other cities may differ | none | jlpt.jp FAQ: certificate never expires; employers may set their own limit |
| JLPT N4 | 680,000 VND | EIU, July 2026 session (https://flc.eiu.edu.vn/?p=8445); plus 30,000 form and 30,000 submission fee; other cities may differ | none | jlpt.jp FAQ: certificate never expires; employers may set their own limit |
| JLPT N5 | 680,000 VND | EIU, July 2026 session (https://flc.eiu.edu.vn/?p=8445); plus 30,000 form and 30,000 submission fee; other cities may differ | none | jlpt.jp FAQ: certificate never expires; employers may set their own limit |
| TOPIK I | — | UNVERIFIED: IIG notices seen only in search results (paper 550,000; iBT 900,000) | 24 | UNVERIFIED: topik.go.kr did not load; 24 is the usual figure |
| TOPIK II | — | UNVERIFIED: IIG notices seen only in search results (paper 770,000; iBT 1,350,000) | 24 | UNVERIFIED: topik.go.kr did not load; 24 is the usual figure |
| HSK 1 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |
| HSK 2 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |
| HSK 3 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |
| HSK 4 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |
| HSK 5 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |
| HSK 6 | — | UNVERIFIED: no official Vietnam fee table found | 24 | UNVERIFIED: chinesetest.cn states none; 24 is the usual figure |

## Preparation courses

Checked 2026-11-11. A duration is stored in whole hours (the column is an integer), rounded from the minutes the provider states. A cost is stored only where the page states one; a Learn path page states no price, so those costs stay empty. All 14 rows prepare for the exam in the "Prepares for" column.

Microsoft Learn pages render the duration with a script that the fetch tool does not see. The Microsoft durations come from Microsoft's public catalogue API (`https://learn.microsoft.com/api/learn/catalog/?type=learningPaths`, field `duration_in_minutes`), which feeds those pages. The exam link comes from the exam's study guide in the same API (AI-901, AZ-305, AZ-400), from the series text on the Part 2 page (AZ-900) and from the course page for AZ-104 (`course.az-104t00`, https://learn.microsoft.com/en-us/training/courses/az-104t00/), which lists this path and "Microsoft Certified: Azure Administrator Associate" as its related certification.

| Course | URL | Hours | Cost | Prepares for | Read |
|---|---|---|---|---|---|
| Introduction to Cloud Infrastructure: Describe cloud concepts | https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/ | 1 | empty | AZ-900 | API: 56 min; Part 1 of the series the Part 2 page recommends for AZ-900 |
| Introduction to Cloud Infrastructure: Describe Azure architecture and services | https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-azure-architecture-services/ | 3 | empty | AZ-900 | API: 168 min; page: "Complete all of the learning paths in the series if you are preparing for Exam AZ-900" |
| Introduction to Cloud Infrastructure: Describe Azure management and governance | https://learn.microsoft.com/en-us/training/paths/describe-azure-management-governance/ | 1 | empty | AZ-900 | API: 81 min; Part 3 of the same series |
| AZ-104: Manage identities and governance in Azure | https://learn.microsoft.com/en-us/training/paths/az-104-manage-identities-governance/ | 4 | empty | AZ-104 | API: 264 min; listed in course AZ-104T00 (related certification: Azure Administrator Associate); the API has no exam study guide for AZ-104 |
| AZ-305: Design identity, governance, and monitor solutions | https://learn.microsoft.com/en-us/training/paths/design-identity-governance-monitor-solutions/ | 2 | empty | AZ-305 | API: 145 min; in the AZ-305 study guide |
| AZ-400: Implement CI with Azure Pipelines and GitHub Actions | https://learn.microsoft.com/en-us/training/paths/az-400-implement-ci-azure-pipelines-github-actions/ | 7 | empty | AZ-400 | API: 396 min; in the AZ-400 study guide |
| AI concepts for developers and technology professionals | https://learn.microsoft.com/en-us/training/paths/ai-concepts/ | 4 | empty | AI-901 | API: 231 min; in the AI-901 study guide |
| Get started with AI applications and agents on Azure | https://learn.microsoft.com/en-us/training/paths/get-started-ai-apps-agents/ | 6 | empty | AI-901 | API: 389 min; in the AI-901 study guide |
| Kubernetes Fundamentals (LFS258) | https://training.linuxfoundation.org/training/kubernetes-fundamentals/ | 35 | 299 USD | CKA | "35 Hours of Course Material"; course only $299 (a $625 bundle adds the exam and a subscription); provides the skills "also tested by" the CKA exam |
| Kubernetes for Developers (LFD259) | https://training.linuxfoundation.org/training/kubernetes-for-developers/ | 35 | 299 USD | CKAD | "35 Hours of Course Material"; course only $299; tested by the CKAD exam |
| Kubernetes Security Essentials (LFS260) | https://training.linuxfoundation.org/training/kubernetes-security-essentials-lfs260/ | empty | 299 USD | CKS | "26-30 Hours of Course Material" is a range, so hours stay empty; $299; tested by the CKS exam |
| Prepare for the Terraform Associate 004 Certification Exam | https://developer.hashicorp.com/terraform/tutorials/certification-003 | empty | empty | Terraform Associate (004) | 3 tutorials of 8, 6 and 3 minutes; no total and no price stated |
| Python Essentials 2 | https://pythoninstitute.org/python-essentials-2 | empty | 0 USD | PCAP | "7-8 weeks", no hours; "Enroll for the course for free!"; "will prepare you for the" PCAP exam |
| Professional Cloud Architect Certification | https://www.skills.google/paths/12 | empty | empty | Professional Cloud Architect | Title and "24 activities" only; hours, level and price are not shown without signing in |

## Course completions

Checked 2026-11-11 on each Coursera page (summarising fetch tool). Each completion has a course of the same name that grants it. Validity is empty for all eight: no page states an expiry (Coursera limits only when the certificate can be claimed, for example "180 days of certificate eligibility" on the Machine Learning page). Cost is empty because Coursera charges a monthly subscription ($49 per month on the Google and Machine Learning pages) or states no price ("Included with Coursera Plus"), not a one-off price. Hours are stored only where the page states a total.

| Completion | URL | Type, level | Hours | Read |
|---|---|---|---|---|
| Google Data Analytics Professional Certificate | https://www.coursera.org/professional-certificates/google-data-analytics | Data & Analytics, Beginner | empty | "6 months at 10 hours a week"; "over 180 hours of instruction" is a lower bound, so empty; $49 per month after a 7-day trial |
| Google Cybersecurity Professional Certificate | https://www.coursera.org/professional-certificates/google-cybersecurity | Security, Beginner | 170 | "170 hours of instruction"; "6 months at 7 hours a week"; $49 per month in the U.S. and Canada |
| Google Project Management Professional Certificate | https://www.coursera.org/professional-certificates/google-project-management | Agile & Project Management, Beginner | empty | "6 months at 10 hours a week"; "over 140 hours of instruction" is a lower bound; $49 per month |
| IBM Data Science Professional Certificate | https://www.coursera.org/professional-certificates/ibm-data-science | Data & Analytics, Beginner | empty | "4 months at 10 hours a week"; no total hours; "Included with Coursera Plus", price not stated |
| Deep Learning Specialization | https://www.coursera.org/specializations/deep-learning | AI & Machine Learning, Intermediate | empty | "3 months at 10 hours a week"; per-course hours only; no price |
| Machine Learning Specialization | https://www.coursera.org/specializations/machine-learning-introduction | AI & Machine Learning, Beginner | empty | "2 months at 10 hours a week"; per-course hours only; $49 per month |
| Meta Front-End Developer Professional Certificate | https://www.coursera.org/professional-certificates/meta-front-end-developer | Frontend Development, Beginner | empty | "7 months at 6 hours a week"; no total hours (the nine course durations are listed, no total); no price ("Enroll for free", "Included with Coursera Plus"); no validity. Earlier an exam row with no cost: it is a course |
| Meta Back-End Developer Professional Certificate | https://www.coursera.org/professional-certificates/meta-back-end-developer | Backend Development, Beginner | empty | "8 months at 6 hours a week"; no total hours; no price ("Enroll for free", "Included with Coursera Plus"); no validity. Earlier an exam row with no cost: it is a course |

## Looked at and not added

| Candidate | Why |
|---|---|
| AWS Skill Builder exam-prep courses | skillbuilder.aws renders with a script: the fetch returned only the site title, so no duration or price could be read. The AWS exam page links to the exam-prep plan but states no duration or price. Only a third-party listing showed a figure, which is not an official source |
| Other Google Cloud learning paths | Only the Professional Cloud Architect path was fetched |
| Google IT Support, Google UX Design Professional Certificates | Fetched, but no catalogue certificate type fits and no new type was invented |
| IBM AI Engineering Professional Certificate | URL returned 404 |
| LFS158 Introduction to Kubernetes | "15-20 Hours of Course Material" is a range and the page does not say it prepares for a certification |
| NVIDIA workshop, Databricks, Scrum.org learning path | The page had no course title, duration or exam link, or returned 404 |
| Introduction to Cloud Infrastructure, Part 4: Apply Azure skills in guided projects | 308 min in the API; the Part 2 page lists it in the AZ-900 series, but its own page was not read and it is hands-on projects, so it was left out |
| GitHub Actions learning paths (GH-200) | No page or API field links them to the GH-200 exam |
| Udemy | Prices change daily; not attempted |

## Removed from the owner's list

| Entry | Why |
|---|---|
| Microsoft Certified: Azure AI Engineer Associate (AI-102) | Retired ("This certification and the renewal assessment are retired") |
| NVIDIA Building RAG Agents with LLMs | An 8-hour workshop, not a certification |
| OpenJS JSNAD, JSNSD | Retired 2025-09-30 (training.linuxfoundation.org) |
| TOEIC 4 Skills | A combo of the two TOEIC tests IIG sells, not a separate certificate |

## Corrected names

| In the owner's list | Official |
|---|---|
| Azure AI Fundamentals (AI-900) | Exam retired 2026-06-30, replaced by AI-901 |
| Azure DevOps Engineer Expert | DevOps Engineer Expert |
| Official Certified Vue.js Developer | Certified Mid-Level Vue.js Developer |
| Certified React Developer | Certified Mid-Level React Developer |

## Open questions

- **JLPT fee** comes from one host university's July 2026 session; other cities may differ.
- **IELTS fee** is published only until 2026-12-31.
- **NVIDIA NCP-GENL** shows "Coming soon" for registration.
- **Oracle:** a newer Java SE 21 exam (1Z0-830) exists; the catalogue keeps Java SE 17 as listed.
- **Vietnam HSK:** whether centres run HSK 3.0 (levels 7 to 9) and each level's fee could not be confirmed.
- **Japanese:** NAT-TEST also runs in Vietnam under Ministry of Education approval; JPT has no evidence of running here. Neither is in the catalogue yet.

## Audit: is any of the 55 converted rows a course and not an exam?

Checked 2026-11-11 against the notes above. Only the two Meta professional certificates are courses ("a course, not an exam", Coursera subscription, no exam fee); they are now completions. Every other row is an exam: AWS, Microsoft, Google Cloud, Linux Foundation, HashiCorp, NVIDIA, Cisco, CompTIA, Databricks, GitHub (GH-200, exam on learn.microsoft.com), Scrum.org, PMI, Oracle, Spring (exam voucher), Certificates.dev (certification exams with a stated fee or 3-year validity), PCAP (exam page), IELTS, TOEIC, TOEFL, JLPT, TOPIK and HSK (tests with fees or score validity). Meta was the only provider whose rows had no fee, no exam and a Coursera link.
