---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "supabase/tests/**"
---

# Testing

- Test đặt cạnh file nguồn: `foo.ts` → `foo.test.ts`.
- RLS test (pgTAP) chạy dưới cả 3 vai trò, gồm cả trường hợp **bị từ chối** (manager đọc team khác, member sửa `refund_status`).
- Logic ngày: test mốc biên -1, 0, 30, 31, 60, 61 ngày, và `No Expiry` / `N/A`; cố định "hôm nay" thay vì dùng giờ hệ thống.
- Import: fixture Excel thật đã ẩn danh trong `src/features/import/__fixtures__/`.
- Không mock Supabase để test RLS — dùng DB local (`supabase start`).
- E2E chỉ cho luồng chính; dùng tài khoản trong `supabase/seed.sql`.
