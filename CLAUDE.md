# CertTracker

App quản lý chứng chỉ cho team, thay thế Excel. Next.js + Supabase (RLS) + Vercel.

## Trạng thái hiện tại

- Giai đoạn 1, **tuần 1–4 xong** (schema, RLS, đăng nhập, CI, deploy; CRUD tổ chức/danh mục; chứng chỉ + minh chứng + Realtime; Import/Export Excel), trừ bước chạy thử với file Excel thật. Tiếp theo: tuần 5 — Dashboard.
- Cập nhật dòng này khi chuyển tuần/giai đoạn.

## Nguồn sự thật (đọc khi cần, đừng đọc hết mỗi phiên)

| Cần biết | File |
|---|---|
| Data model, RLS, luồng, lộ trình | `docs/superpowers/specs/2026-09-26-certtracker-design.md` |
| Các quyết định đã chốt + lý do | `docs/decisions.md` |
| Token, component, pattern UI | `docs/design-system.md` (xem trực quan: `/design` khi chạy dev) |
| Kế hoạch triển khai | `docs/superpowers/plans/` |
| Yêu cầu gốc | `CertTracker - Feature List.pdf` |

Không bàn lại quyết định đã có trong `docs/decisions.md` trừ khi người dùng yêu cầu. Quyết định mới → thêm một mục vào file đó.

## Lệnh

```bash
pnpm dev            # dev server
pnpm lint && pnpm typecheck
pnpm test           # Vitest
pnpm test:db        # pgTAP (cần `supabase start`)
pnpm test:e2e       # Playwright
pnpm db:types       # sinh src/types/database.ts sau mỗi migration
supabase db reset   # chạy lại migrations + seed local
```

## Quy tắc bất biến

1. **RLS là lớp bảo mật chính.** Truy vấn của người dùng luôn qua `lib/supabase/server.ts` (JWT người dùng). Không lọc quyền bằng code thay cho RLS.
2. **Service role** chỉ trong `lib/supabase/admin.ts` (`import "server-only"`), chỉ cho cron (import chạy bằng JWT của admin, xem decisions #20).
3. Mọi view tạo với `security_invoker = true`.
4. Trường tính toán (expiry, days_to_expiry) nằm trong view, không lưu vào bảng.
5. Ngày tháng tính theo `Asia/Ho_Chi_Minh` (dùng `lib/dates.ts`), không dùng `current_date` UTC trần.
6. Không dùng `any`; validate input bằng Zod ở server kể cả khi client đã validate.
7. Không commit secret; `.env.local` không vào git.

## Quy ước

- **Ngôn ngữ:** trao đổi với người dùng bằng tiếng Việt; code, tên biến, comment, commit bằng tiếng Anh; text trên UI bằng tiếng Việt.
- **Tổ chức code theo nghiệp vụ:** `src/features/<feature>/{actions.ts, queries.ts, schema.ts, components/}`.
- Server Action trả về `Result<T>`; không throw ra UI.
- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Branch: `feat/<tên>`, `fix/<tên>`.
- Thay đổi schema = file mới trong `supabase/migrations/` + test RLS tương ứng + `pnpm db:types`.

## Quy trình làm việc

- Tính năng mới: brainstorm → plan (`docs/superpowers/plans/`) → TDD → review.
- Chưa được yêu cầu thì không commit/push.
- Trước khi báo "xong": chạy lint, typecheck, test liên quan và nêu kết quả thật.

Rule chi tiết theo vùng code: `.claude/rules/` (tự nạp khi làm việc với file khớp đường dẫn).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
