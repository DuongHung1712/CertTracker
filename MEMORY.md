# MEMORY — trạng thái động (cập nhật 2026-11-11)

Nguồn đầy đủ: `docs/decisions.md`, `docs/process/04-wbs.md`. File này chỉ là bản tóm tắt cho phiên sau.

## 1. Trạng thái

- **Giai đoạn:** Cert Core đã chạy trên `main` và production (2026-11-05), cloud chưa có dữ liệu thật. Đang chuẩn bị pilot DAS giai đoạn 1 (20 người, gói miễn phí; decision #61).
- **Nhánh hiện tại:** `feat/certificate-catalogue`: Part D (tách certificate/course, decision #65) đã code xong, đã qua gate đầy đủ, **chưa merge** (tiếp theo: PR vào `dev`).
- `feat/cert-core-accounts` đã merge vào `dev`; các migration `20261106000001`, `20261110000001/3`, `20261111000001/2/3` **chưa `db push` lên production** (rollout ở `docs/deploy/accounts-and-catalogue.md`).

## 2. Backlog

1. PR `feat/certificate-catalogue` vào `dev`; owner làm production: backup → `supabase db push` → merge `main` (spec §8).
3. Pilot giai đoạn 2 (WBS 15.4–15.6): gửi/duyệt chứng chỉ, lĩnh vực quan tâm, số liệu theo tháng/quý.
4. C2 AI (DeepSeek) → C3 hosting, G1, production.
5. Nợ: migration xóa `team_managers` (#58).
6. Later: Skill Matrix, mục tiêu theo quý, lộ trình role, backend Rust.

## 3. ADR tóm tắt

- **#59 Release Cert Core trước** (thay #54): ra phần chứng chỉ sớm để pilot, hoãn Skill Matrix.
- **#20 Import chạy bằng JWT admin**: service role chỉ cho cron, để RLS luôn là lớp bảo mật chính.
- **#55 Ba vai trò** (Admin, Manager theo phạm vi, Member): đủ cho DAS, tránh ma trận quyền phức tạp.
- **#51 UI English-first**, song ngữ sau Release 1.

## 4. Gotchas

- Next.js 16 / React 19 có breaking change: đọc `node_modules/next/dist/docs/` trước khi code.
- Ngày tính theo `Asia/Ho_Chi_Minh` (`lib/dates.ts`); `current_date` trần sẽ lệch UTC.
- Mọi view cần `security_invoker = true`, nếu không RLS bị bỏ qua.
- Sau mỗi migration chạy `pnpm db:types`; `pnpm test:db` cần `supabase start`.
- Repo có nhiều `.worktrees/*` (mỗi cái có CLAUDE.md riêng): tránh nhầm khi grep/glob.
- Cron Vercel chạy UTC (01:00 UTC = 08:00 VN).
