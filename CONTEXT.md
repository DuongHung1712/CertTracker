# CONTEXT — CertTracker

Bối cảnh nghiệp vụ và kiến trúc. Quy tắc vận hành: `CLAUDE.md`. Trạng thái động: `MEMORY.md`.

## 1. Domain

Team quản lý chứng chỉ (thay Excel): ai có chứng chỉ gì, khi nào hết hạn, chi phí khóa học, dữ liệu sạch.

**Thực thể chính** (`supabase/migrations/`):

```
dcs ─< programs ─< teams ─< members ─< training_records >─ cert_types
                     │         │                               │
                manager_scopes │                           providers ─< courses
                (phạm vi mgr)  └─ profiles (1-1 auth.users, role)
members ─< career_roles   (role/YoE)
import_batches ─< import_rows   (staging import Excel)
notification_log               (cron e-mail hết hạn)
```

- **Vai trò (3):** Admin (= DC lead), Manager (phạm vi team/program qua `manager_scopes`), Member (decision #55).
- `training_records`: bản ghi chứng chỉ của member; `expiry`, `days_to_expiry` là trường tính trong view, không lưu bảng.
- `team_managers` là bảng cũ, còn nợ migration xóa (decision #58).

## 2. Cây thư mục

```
src/
  app/
    (auth)/ (app)/ (dev)/     # route groups; (app) = dashboard, records, members,
                              # courses, import, data-quality, org, me, profile, settings
    api/cron/{expiry-alerts,monthly-report}   # Vercel cron (service role)
    api/export/records, api/import/parse, api/records/[id]/evidence
  features/<nghiệp vụ>/       # actions.ts, queries.ts, schema.ts, components/
    auth career courses dashboard data-quality export import
    members notifications organizations profile records
  components/{ui,app-shell,data,status}   # shadcn-style + shell + badge
  lib/supabase/{server,admin}.ts, lib/dates.ts
supabase/migrations/          # schema + RLS; supabase/tests = pgTAP
e2e/                          # Playwright
docs/{decisions.md, design-system.md, deploy/, process/, superpowers/{specs,plans}}
.claude/rules/                # rule theo vùng code
```

## 3. Luồng chính

1. **Auth + liên kết tài khoản:** đăng nhập e-mail → `profiles` gắn `members` (migration `link_account_to_member`) → role quyết định menu (`navForUser`) và phạm vi RLS.
2. **Import dữ liệu:** upload Excel → `/api/import/parse` → `import_batches/import_rows` (staging) → `features/import/clean` chuẩn hóa (vd. "chưa bắt đầu" → `not_started`) → admin duyệt, chạy bằng JWT admin (decision #20) → `training_records`; lỗi hiện ở `data-quality`.
3. **Cảnh báo hết hạn:** Vercel cron thứ Hai 01:00 UTC (`expiry-alerts`) và ngày 1 hàng tháng (`monthly-report`) → service role đọc view expiry → gửi e-mail → ghi `notification_log`.

## 4. Hạ tầng & dịch vụ ngoài

| Thành phần | Chi tiết |
|---|---|
| DB/Auth/Storage | Supabase Postgres + RLS (evidence file, realtime ở migration `records_list_evidence_realtime`) |
| Hosting | Vercel (cron trong `vercel.json`); gói miễn phí cho pilot (`docs/deploy/task9-free-tier.md`) |
| E-mail | `docs/deploy/cron-email.md` |
| AI (sau pilot) | DeepSeek, decision #52 (C2) |
| Cache / queue | Không có |
