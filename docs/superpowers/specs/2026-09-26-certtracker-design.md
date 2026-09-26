# CertTracker — Design Spec

- **Ngày:** 2026-09-26
- **Trạng thái:** Đã duyệt thiết kế, chờ review spec
- **Nguồn yêu cầu:** `CertTracker - Feature List.pdf` (9 nhóm tính năng), `ai-tool-ideas 2.html` (proposal SkillMatrix / AI Analyst / FiGen v2)

---

## 1. Bối cảnh & mục tiêu

CertTracker là app quản lý chứng chỉ (certification) cho team DC34, thay thế file Excel/Google Sheets hiện tại. Gồm 7 nhóm tính năng nền tảng (A) và 2 nhóm AI (B).

**Quan hệ với SkillMatrix:** Proposal SkillMatrix cần một "Employee Skill Repository" (có certifications) và xác định rủi ro chính là *dữ liệu lỗi thời*, không phải thuật toán. CertTracker là nguồn dữ liệu cert sạch cho SkillMatrix sau này. CertTracker được build **độc lập**, nhưng data model (Member, Course, TrainingRecord) được thiết kế để tái sử dụng.

**Mục tiêu giai đoạn 1:** team thật bỏ file Excel; dữ liệu cũ được import sạch; cảnh báo hết hạn chạy tự động.

## 2. Ràng buộc & quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Hosting / dữ liệu | Cloud SaaS được phép: Supabase Cloud + Vercel |
| Đội ngũ | 1–2 người, TypeScript; MVP ~6 tuần |
| Vai trò | Admin / Manager / Member |
| Cơ cấu tổ chức | Phân cấp cha-con: DC → Program → Team. Member thuộc **1 team chính**; Manager quản lý **nhiều team** |
| Xếp hạng cá nhân | Chỉ Manager/Admin xem |
| Lưu file minh chứng | Supabase Storage (private bucket + RLS), qua interface `FileStorage` để có thể đổi provider (vd. Cloudinary) |
| AI | LLM bên thứ ba qua API key, gọi từ server; provider-agnostic |
| SSO | Để sau (tuần 6); chỉ là bật provider Google/Microsoft trong Supabase Auth |

## 3. Kiến trúc tổng thể

**Hướng đã chọn:** Next.js fullstack + Supabase, **RLS là lớp bảo mật chính**. Mọi truy vấn của người dùng (kể cả truy vấn do AI khởi tạo) chạy bằng JWT của chính người dùng, nên DB tự lọc theo quyền.

```
Browser ──> Next.js (Vercel) ──────────────> Supabase
            ├ UI: React Server Components     ├ Postgres + RLS policies
            ├ Server Actions (CRUD)           ├ Views: v_training_records, v_data_quality_issues
            ├ Route handlers /api/ai/*  ──> LLM API (AI SDK)
            ├ Route handlers /api/import/*    ├ RPC: KPI, ranking, commit_import
            └ /api/cron/* <── Vercel Cron     ├ Auth (email; SSO sau)
                   └──> Resend (email)        ├ Realtime (training_records)
                                              └ Storage (bucket certificates, private)
```

**Các hướng đã loại:**
- React SPA + Edge Functions (Deno): hạn chế thư viện cho AI/Excel, logic phân mảnh.
- Next.js + ORM, Supabase chỉ làm Postgres: mất RLS/Realtime, tăng rủi ro rò dữ liệu qua AI.

### 3.1 Tech stack

| Phần | Lựa chọn |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS + shadcn/ui, TanStack Table, Recharts |
| Form / validate | React Hook Form + Zod (schema dùng chung client/server) |
| DB / Auth | Supabase Postgres + RLS; `supabase` CLI migrations; type sinh bằng `supabase gen types` |
| File | Supabase Storage sau interface `FileStorage` |
| Email | Resend + React Email |
| Cron | Vercel Cron → `/api/cron/*`, xác thực bằng `CRON_SECRET` |
| AI | Vercel AI SDK; mặc định Claude Haiku 4.5 (trích xuất/phân loại), Claude Sonnet 5 (suy luận/viết); output ràng buộc bằng Zod schema |
| Import / Export | SheetJS (xlsx) |
| Test | pgTAP (RLS), Vitest, Playwright |
| CI | GitHub Actions + Vercel Preview mỗi PR |

## 4. Data model

### 4.1 Bảng

```
dcs             (id uuid PK, name UNIQUE)
programs        (id uuid PK, name, dc_id → dcs)
teams           (id uuid PK, name, program_id → programs)
team_managers   (team_id → teams, user_id → auth.users, PK(team_id, user_id))
profiles        (user_id PK → auth.users, role: 'admin'|'manager'|'member',
                 member_id → members NULL)

members         (id uuid PK, code text UNIQUE  -- 'M001', sinh từ sequence
                 full_name, email citext UNIQUE, team_id → teams,
                 is_active bool DEFAULT true, created_at, updated_at)

cert_types      (id uuid PK, name UNIQUE)          -- AI, Cloud, Security...
providers       (id uuid PK, name UNIQUE)          -- AWS, Google, Microsoft, NVIDIA...
courses         (id uuid PK, name, cert_type_id → cert_types, provider_id → providers,
                 level, validity_months int NULL   -- NULL = không hết hạn
                 refundable bool, cost numeric NULL, est_hours int NULL, url)

training_records(id uuid PK, member_id → members, course_id → courses,
                 status: 'not_started'|'in_progress'|'done',
                 progress int 0..100,
                 planned_exam_date date, issued_date date,
                 certificate_url text, evidence_path text  -- key trong Storage
                 via_company bool,
                 refund_status: 'n_a'|'pending'|'approved'|'rejected'|'paid',
                 notes text, progress_updated_at timestamptz,
                 created_by → auth.users, created_at, updated_at)

import_batches  (id, created_by, file_name, status: 'parsed'|'committed'|'discarded', created_at)
import_rows     (id, batch_id, row_no, raw jsonb, normalized jsonb,
                 action: 'create'|'update'|'skip', errors jsonb)

notification_log(id, kind, period text, recipient_email, sent_at,
                 UNIQUE(kind, period, recipient_email))
```

Quy ước:
- Khóa chính là UUID; `members.code` chỉ là mã hiển thị (`'M' || lpad(nextval, 3, '0')`).
- Email so khớp không phân biệt hoa thường (`citext`).

### 4.2 Trường tính toán — view `v_training_records`

Không lưu cứng vì `days_to_expiry` thay đổi mỗi ngày. View tạo với `security_invoker = true` để RLS vẫn áp dụng.

- `today = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`
- `expiry_date = issued_date + validity_months * interval '1 month'` (NULL nếu thiếu `issued_date` hoặc `validity_months`)
- `days_to_expiry = expiry_date - today`
- `expiry_status`:
  - `No Expiry` — `validity_months` NULL
  - `N/A` — chưa có `issued_date`
  - `Expired` — `days_to_expiry < 0`
  - `Expiring Soon` — `0 ≤ days_to_expiry ≤ 30`
  - `Expiring in 60d` — `31 ≤ days_to_expiry ≤ 60`
  - `Active` — `days_to_expiry > 60`

### 4.3 Ràng buộc toàn vẹn

- `CHECK`: `status = 'done'` ⇒ `progress = 100 AND issued_date IS NOT NULL`
- `CHECK`: `status = 'not_started'` ⇒ `progress = 0`
- `CHECK`: `status = 'in_progress'` ⇒ `progress BETWEEN 0 AND 99`
- Trigger: cập nhật `progress_updated_at` khi `progress` đổi; cập nhật `updated_at` mọi bảng.

## 5. Phân quyền (RLS)

Helper functions (`SECURITY DEFINER`, `STABLE`, `search_path` cố định):
- `app_role()` → role của `auth.uid()`
- `my_member_id()` → `profiles.member_id` của user
- `managed_team_ids()` → tập `team_id` user quản lý

| Đối tượng | Admin | Manager | Member |
|---|---|---|---|
| dcs, programs, teams | toàn quyền | xem | xem |
| team_managers, profiles | toàn quyền | xem của mình | xem của mình |
| members | toàn quyền | xem/sửa khi `team_id ∈ managed_team_ids()` | xem chính mình |
| cert_types, providers, courses | toàn quyền | xem | xem |
| training_records | toàn quyền | CRUD khi member thuộc team mình quản lý | xem/thêm/sửa khi `member_id = my_member_id()` |
| import_batches / import_rows | toàn quyền | không | không |
| Storage `certificates/{member_id}/{record_id}/{file}` | toàn quyền | xem/ghi file của member trong team mình | xem/ghi file của mình |

**Giới hạn theo cột (trigger BEFORE UPDATE):** Member không được thay đổi `member_id`, `refund_status`, `via_company`.

**Số liệu toàn đơn vị:** Member chỉ thấy dòng của mình qua RLS, nên KPI tổng hợp cho mọi người được trả qua RPC `SECURITY DEFINER` chỉ chứa con số tổng hợp, không kèm danh tính. RPC xếp hạng cá nhân (có tên) kiểm tra `app_role() IN ('admin','manager')` và trả lỗi với role khác; Manager chỉ thấy người trong team mình quản lý.

**Service role key:** chỉ dùng trong `src/lib/supabase/admin.ts` (có `import "server-only"`, rule lint cấm import ở nơi khác), chỉ cho cron và commit import.

## 6. Luồng chức năng

### 6.1 CRUD nền tảng (nhóm 1–3)
Server Actions theo từng feature; validate bằng Zod ở client và server; trả về `Result<T>`. Lỗi constraint Postgres map sang thông báo tiếng Việt.

Upload minh chứng: client → Server Action → `FileStorage.upload()` → lưu `evidence_path`; xem qua signed URL ngắn hạn từ `FileStorage.getSignedUrl()`.

```ts
interface FileStorage {
  upload(path: string, file: Blob, contentType: string): Promise<{ path: string }>;
  getSignedUrl(path: string, expiresInSec: number): Promise<string>;
  delete(path: string): Promise<void>;
}
```

### 6.2 Dashboard (nhóm 4)
- KPI: tổng member, tổng record, số Done + tỉ lệ %, In Progress, Expired, Active.
- Thống kê theo team, CertType, provider; độ phổ biến course; tỉ lệ hoàn thành theo provider.
- Xếp hạng cá nhân: chỉ Manager/Admin.
- Realtime: subscribe `postgres_changes` trên `training_records` → invalidate dữ liệu trang.

### 6.3 Import / Export (nhóm 6)

```
Upload .xlsx ─> /api/import/parse ─> Pipeline làm sạch ─> import_batches + import_rows
                                                                  │
                  UI Preview: create/update/skip + lỗi từng dòng (Admin duyệt)
                                                                  │
                         "Xác nhận" ─> RPC commit_import(batch_id) — 1 transaction
```

Pipeline làm sạch (hàm TS thuần, mỗi quy tắc có unit test):
- `normalizeStatus` — map biến thể ("Hoàn thành", "Completed", "xong", "Đang học"...) → 3 giá trị chuẩn; không map được → lỗi dòng.
- `trimCertType` — trim + gộp khoảng trắng.
- `progressToPercent` — `0.75` → `75`; giá trị đã là 0–100 giữ nguyên.
- `excelSerialToDate` — **chuyển** số serial Excel sang ngày thật (không xóa dòng).
- `dedupeMembersByEmail` — `lower(trim(email))`; trùng thì gộp.
- Tham chiếu member/course không tồn tại → tạo mới (nếu đủ dữ liệu) hoặc báo lỗi dòng.

`commit_import` idempotent: batch đã `committed` thì không chạy lại.

Export: CSV có **UTF-8 BOM** và `.xlsx`; dữ liệu lấy qua client của người dùng (tuân RLS).

### 6.4 Chất lượng dữ liệu (nhóm 5)
Constraint (FK, CHECK) chặn tham chiếu sai và status/progress lệch ngay trong DB; lỗi đầu vào được bắt ở staging import. View `v_data_quality_issues` bắt phần còn lại: quá `planned_exam_date` mà chưa Done, member chưa có team, course thiếu `validity_months`, record Done thiếu minh chứng.

### 6.5 Cron & email (nhóm 5, 7)

| Job | Lịch (UTC) | Nội dung |
|---|---|---|
| `/api/cron/expiry-alerts` | `0 1 * * 1` (08:00 thứ Hai giờ VN) | Manager: cert hết hạn ≤60 ngày của team mình quản lý. Member: cert của mình |
| `/api/cron/monthly-report` | `0 1 1 * *` (08:00 ngày 1 giờ VN) | KPI tháng gửi Manager (theo team) và Admin (toàn DC) |

- Xác thực header `Authorization: Bearer ${CRON_SECRET}`.
- Dùng service role; job tự lọc dữ liệu theo phạm vi người nhận.
- Trước khi gửi, insert `notification_log (kind, period, recipient)`; vi phạm unique ⇒ đã gửi, bỏ qua (chống gửi trùng khi retry).
- Mọi phép tính ngày theo `Asia/Ho_Chi_Minh`.

## 7. AI (giai đoạn 2 — nhóm 8, 9)

### 7.1 Nguyên tắc
- AI gọi từ server (route handler), API key chỉ nằm trong env server.
- Dữ liệu cho AI lấy qua Supabase client mang JWT người dùng ⇒ tuân RLS.
- `pii.ts`: thay tên/email bằng `members.code` trước khi gửi prompt; map ngược khi hiển thị.
- `governor.ts`: giới hạn số request/ngày/user; ghi `ai_runs (feature, user_id, model, input_tokens, output_tokens, cost, latency_ms, created_at)`.
- Mọi output AI ràng buộc bằng Zod schema; kết quả có tác động dữ liệu phải qua bước người dùng xác nhận.
- AI lỗi/timeout ⇒ tính năng suy giảm nhẹ nhàng, app vẫn chạy.

### 7.2 Cấu trúc

```
src/lib/ai/
  provider.ts          -- chọn model theo tác vụ
  pii.ts  governor.ts
  features/<name>/     -- schema.ts · prompt.ts · run.ts
```

### 7.3 Tính năng & cách tiếp cận

| Tính năng | Cách tiếp cận |
|---|---|
| Đọc ảnh/PDF chứng chỉ | Model đa phương thức → `{course_name, provider, issued_date, expiry_date, confidence}` → điền sẵn form, người dùng xác nhận |
| Phân loại CertType/Provider | Haiku, chọn từ danh sách có sẵn hoặc đề xuất mới |
| Gợi ý gộp tên course khi import | Chạy trên `import_rows`; hiển thị cặp nghi trùng ở màn Preview |
| AI Insights | Tính số liệu bằng SQL, LLM chỉ viết nhận xét tiếng Việt; đưa vào email tháng |
| Completion Risk | Điểm Low/Medium/High **tính bằng rule** (thời gian đứng yên `progress_updated_at`, khoảng cách tới `planned_exam_date` so với progress); LLM chỉ viết gợi ý hành động |
| Cert Recommendation | Input: cert đã có, team, level, `project_skill_requirements`; ưu tiên course `refundable`; output kèm lý do, `est_hours`, url |
| Skill Gap Analysis | Bảng mới `project_skill_requirements (team_id, cert_type_id / course_id, min_count, priority)` do Manager khai báo; gap tính bằng SQL, cảnh báo phụ thuộc 1–2 người và key person sắp hết hạn |
| Training Plan Generator | Từ mục tiêu manager → đề xuất người/cert/timeline, ước tính chi phí và phần refund |
| Ask Your Data | LLM **không sinh SQL**; sinh *query spec* JSON (view, cột, filter, group by, sort, limit) trong whitelist; server dựng truy vấn bằng query builder, chạy với JWT người dùng; trả bảng hoặc biểu đồ |

## 8. Cấu trúc thư mục

```
CertTracker/
├─ supabase/
│  ├─ migrations/          -- schema, views, RLS, triggers, RPC
│  ├─ seed.sql             -- dữ liệu mẫu + user test admin/manager/member
│  └─ tests/               -- pgTAP
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (app)/dashboard/ members/ teams/ courses/ records/ import/ settings/
│  │  └─ api/cron/ api/import/ api/ai/
│  ├─ features/            -- members/ courses/ records/ dashboard/ import/ notifications/
│  │                          (mỗi cái: actions.ts · queries.ts · schema.ts · components/)
│  ├─ lib/
│  │  ├─ supabase/         -- server.ts · client.ts · admin.ts (server-only)
│  │  ├─ storage/          -- FileStorage + SupabaseStorage
│  │  ├─ ai/               -- giai đoạn 2
│  │  ├─ email/            -- React Email templates + sender
│  │  └─ dates.ts          -- múi giờ VN, tính expiry
│  ├─ components/ui/       -- shadcn
│  └─ types/database.ts    -- supabase gen types
├─ e2e/                    -- Playwright
└─ vercel.json             -- cron schedules
```

## 9. Chiến lược test

| Ưu tiên | Loại | Phạm vi |
|---|---|---|
| 1 | pgTAP — RLS | Đăng nhập 3 vai trò; Manager không thấy team khác; Member không sửa `refund_status`; Member không gọi được RPC xếp hạng; Storage policy |
| 2 | Vitest | Pipeline làm sạch import (fixture Excel thật đã ẩn danh), tính expiry, chọn người nhận email |
| 3 | SQL test | `v_training_records` tại biên -1, 0, 30, 31, 60, 61 ngày; `No Expiry`, `N/A` |
| 4 | Playwright | Đăng nhập → thêm record; Import → preview → commit; Member upload minh chứng |

CI (GitHub Actions): `supabase start` → migrations → pgTAP → Vitest → `next build`. Vercel Preview mỗi PR.

## 10. Lộ trình

### Giai đoạn 1 — MVP thay Excel (~6 tuần)

| Tuần | Deliverable |
|---|---|
| 1 | Setup repo/Supabase/Vercel/CI; toàn bộ migration (schema, view, RLS, trigger); pgTAP RLS; đăng nhập email |
| 2 | CRUD DC/Program/Team/Member và Course/CertType/Provider |
| 3 | Training Records: danh sách + lọc, form, upload minh chứng, badge expiry, Realtime |
| 4 | Import Excel (pipeline + staging + preview + commit) và Export; chạy thử với file thật |
| 5 | Dashboard: KPI, thống kê, xếp hạng (Manager/Admin) |
| 6 | Cron + email, `notification_log`, trang chất lượng dữ liệu; SSO nếu đã chốt; UAT với 1 team thật |

**Tiêu chí qua giai đoạn 2:** team thật bỏ Excel, dữ liệu import sạch, email thứ Hai chạy đúng 2 tuần liên tiếp.

### Giai đoạn 2 — AI (~6 tuần)

| Tuần | Tính năng |
|---|---|
| 7 | Khung `lib/ai` (provider, governor, pii, `ai_runs`); đọc ảnh/PDF chứng chỉ; phân loại CertType/Provider |
| 8 | Gợi ý gộp tên course khi import; AI Insights trong email tháng |
| 9 | Completion Risk (rule-based + gợi ý bằng LLM) |
| 10 | `project_skill_requirements`; Cert Recommendation; Skill Gap Analysis |
| 11 | Training Plan Generator |
| 12 | Ask Your Data (query spec whitelist) |

## 11. Ngoài phạm vi (YAGNI)

- Member thuộc nhiều team cùng lúc.
- Lịch sử thay đổi đầy đủ (audit log) — chỉ lưu `progress_updated_at`, `created_by`, `updated_at`.
- Đa ngôn ngữ giao diện (chỉ tiếng Việt; tên dữ liệu giữ nguyên như nhập).
- Mobile app native (web responsive là đủ).
- Tích hợp HRIS / SkillMatrix — chỉ giữ data model tương thích.

## 12. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| RLS viết sai gây rò dữ liệu | pgTAP cho từng vai trò trong CI; `security_invoker` cho mọi view |
| Service role key bị dùng sai chỗ | Chỉ trong `admin.ts` + `server-only` + lint rule |
| File Excel cũ bẩn hơn dự kiến | Staging + preview; chạy thử file thật từ tuần 4 |
| Lệch ngày do múi giờ | Mọi phép tính ngày theo `Asia/Ho_Chi_Minh`; test biên |
| Email gửi trùng/thiếu | `notification_log` unique; log kết quả gửi |
| AI chi phí tăng / hallucination | Governor + `ai_runs`; output Zod; HITL; số liệu tính bằng SQL, LLM chỉ diễn giải |
| Text-to-SQL vượt quyền | Query spec whitelist, không SQL tự do, chạy với JWT người dùng |
