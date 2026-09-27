# CertTracker

> Ứng dụng quản lý chứng chỉ (certification) cho team DC — thay thế file Excel/Google Sheets, tự động cảnh báo cert sắp hết hạn và hỗ trợ AI gợi ý lộ trình học.

![Status](https://img.shields.io/badge/status-in_development-blue)
![Next.js](https://img.shields.io/badge/Next.js-App_Router-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_RLS-3ECF8E?logo=supabase&logoColor=white)

> [!NOTE]
> Giai đoạn 1 tuần 1 (schema, RLS, đăng nhập, CI, deploy) và design system đã xong. Đang làm tuần 2. Xem [design spec](docs/superpowers/specs/2026-09-26-certtracker-design.md) cho kiến trúc/dữ liệu và [design system](docs/design-system.md) cho token/component UI.

## Mục lục

- [Tính năng](#tính-năng)
- [Tech stack](#tech-stack)
- [Kiến trúc](#kiến-trúc)
- [Bắt đầu](#bắt-đầu)
- [Scripts](#scripts)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Kiểm thử](#kiểm-thử)
- [Lộ trình](#lộ-trình)
- [Đóng góp](#đóng-góp)

## Tính năng

### Nền tảng (Giai đoạn 1)

- **Members & Teams** — CRUD thành viên (mã tự sinh `M001`), cơ cấu DC → Program → Team.
- **Courses** — danh mục chứng chỉ theo CertType, provider, level, thời hạn hiệu lực, thông tin refund.
- **Training Records** — theo dõi cert từng người; tự tính `ExpiryDate`, `DaysToExpiry`, `ExpiryStatus`; upload minh chứng.
- **Dashboard** — KPI, thống kê theo team / CertType / provider, xếp hạng (Manager/Admin), cập nhật realtime.
- **Cảnh báo tự động** — email thứ Hai (cert hết hạn ≤ 60 ngày), báo cáo KPI ngày 1 hằng tháng.
- **Import / Export** — import Excel cũ có làm sạch và xem trước; export CSV/Excel UTF-8.
- **Phân quyền** — Admin / Manager / Member bằng Supabase Auth + Row Level Security.

### AI (Giai đoạn 2)

- Đọc ảnh/PDF chứng chỉ để tự điền form.
- Gợi ý cert tiếp theo, Training Plan, Skill Gap Analysis.
- Dự đoán rủi ro không hoàn thành, AI Insights trong báo cáo tháng.
- Ask Your Data — hỏi dữ liệu bằng ngôn ngữ tự nhiên (query spec whitelist, tuân RLS).

## Tech stack

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Table, Recharts |
| Form / validate | React Hook Form, Zod |
| Backend | Next.js Server Actions & Route Handlers |
| Database / Auth | Supabase — Postgres, Row Level Security, Auth, Realtime, Storage |
| Email | Resend + React Email |
| Cron | Vercel Cron |
| AI | Vercel AI SDK (Claude) |
| Import / Export | SheetJS |
| Test | Vitest, pgTAP, Playwright |
| Hosting | Vercel + Supabase Cloud |

## Kiến trúc

```
Browser ──> Next.js (Vercel) ──────────────> Supabase
            ├ Server Actions (CRUD)           ├ Postgres + RLS
            ├ /api/import/*                   ├ Views & RPC
            ├ /api/ai/*  ──────────> LLM API  ├ Auth
            └ /api/cron/* <── Vercel Cron     ├ Realtime
                   └──> Resend                └ Storage (private)
```

Mọi truy vấn chạy bằng JWT của người dùng nên **RLS là lớp bảo mật chính** — kể cả với truy vấn do AI khởi tạo. Chi tiết: [design spec](docs/superpowers/specs/2026-09-26-certtracker-design.md).

## Bắt đầu

### Yêu cầu

- Node.js 24+ và pnpm (CI dùng Node 24)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- Docker (để chạy Supabase local)

### Cài đặt

```bash
git clone https://github.com/DuongHung1712/CertTracker.git
cd CertTracker
pnpm install
cp .env.example .env.local
supabase start
supabase db reset        # chạy migrations + seed
pnpm dev
```

Mở <http://localhost:3000>. Tài khoản test (admin / manager / member) được tạo trong `supabase/seed.sql`.

### Biến môi trường

| Biến | Mô tả |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (public, bị giới hạn bởi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — chỉ dùng cho cron và commit import |
| `RESEND_API_KEY` | Gửi email |
| `CRON_SECRET` | Xác thực request từ Vercel Cron |
| `ANTHROPIC_API_KEY` | AI (Giai đoạn 2) |

> [!WARNING]
> Không commit `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` vượt qua RLS — tuyệt đối không dùng ở client.

## Scripts

| Lệnh | Mô tả |
|---|---|
| `pnpm dev` | Chạy dev server |
| `pnpm build` | Build production |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit test (Vitest) |
| `pnpm test:db` | Test RLS (pgTAP) |
| `pnpm test:e2e` | E2E test (Playwright) |
| `pnpm db:types` | Sinh TypeScript types từ schema Supabase |

## Cấu trúc thư mục

```
├─ supabase/
│  ├─ migrations/        # schema, views, RLS, triggers, RPC
│  ├─ seed.sql
│  └─ tests/             # pgTAP
├─ src/
│  ├─ app/               # routes (auth, app, dev, api)
│  ├─ features/          # members, courses, records, dashboard, import, notifications
│  ├─ lib/               # supabase, storage, email, ai, dates, format, design (contrast)
│  ├─ components/
│  │  ├─ ui/             # shadcn (base-nova)
│  │  ├─ app-shell/       # AppSidebar, Topbar, PageHeader
│  │  ├─ data/            # DataTable, FilterBar, EmptyState
│  │  └─ status/          # ExpiryBadge, RecordStatusLabel, RoleBadge, MemberCode
│  └─ types/
├─ e2e/                  # Playwright
└─ docs/                 # design spec, design system, plans
```

## Kiểm thử

Ưu tiên theo rủi ro:

1. **RLS (pgTAP)** — mỗi vai trò chỉ thấy/sửa đúng dữ liệu của mình.
2. **Unit (Vitest)** — pipeline làm sạch import, tính expiry.
3. **SQL** — `v_training_records` tại các mốc biên 0 / 30 / 60 ngày.
4. **E2E (Playwright)** — đăng nhập, điều hướng, `/design`, khung app (không cuộn ngang, ngăn kéo tự đóng). Chạy cục bộ (`pnpm test:e2e`, cần `supabase start`); chưa có trong CI.

CI (GitHub Actions) chạy lint, typecheck, unit test, pgTAP và build trên mỗi pull request.

## Lộ trình

- [ ] **Giai đoạn 1 — MVP thay Excel** (~6 tuần)
  - [x] Tuần 1: Setup, schema, RLS, đăng nhập
  - [ ] Tuần 2: CRUD Members / Teams / Courses
  - [ ] Tuần 3: Training Records, upload minh chứng, realtime
  - [ ] Tuần 4: Import / Export Excel
  - [ ] Tuần 5: Dashboard
  - [ ] Tuần 6: Cron + email, UAT
- [ ] **Giai đoạn 2 — AI** (~6 tuần)

## Đóng góp

1. Tạo branch từ `dev`: `feat/<tên>`, `fix/<tên>`. `dev` merge vào `main` khi deploy production.
2. Commit theo [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`...).
3. Mọi thay đổi schema đi qua `supabase/migrations/` kèm test RLS.
4. Mở pull request; CI phải xanh trước khi merge.

## License

Dự án nội bộ DC34 — chưa công bố license.
