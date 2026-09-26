---
paths:
  - "supabase/**"
  - "src/lib/supabase/**"
---

# Database & RLS

- Mỗi thay đổi schema là **một migration mới**; không sửa migration đã merge.
- Bảng mới: bật `ENABLE ROW LEVEL SECURITY` ngay trong cùng migration, kèm policy cho cả 3 vai trò (admin / manager / member).
- Dùng helper `app_role()`, `my_member_id()`, `managed_team_ids()` trong policy; helper là `SECURITY DEFINER STABLE` và đặt `SET search_path = public`.
- Hàm `SECURITY DEFINER` trả dữ liệu tổng hợp không được trả tên/email; hàm trả dữ liệu cá nhân phải kiểm tra `app_role()` bên trong.
- Hạn chế theo cột (vd. Member không sửa `refund_status`, `via_company`, `member_id`) làm bằng trigger `BEFORE UPDATE`.
- Toàn vẹn dữ liệu bằng `CHECK`/FK trong DB, không chỉ ở Zod.
- Khóa chính UUID; `members.code` (`M001`) chỉ để hiển thị.
- Email dùng `citext`.
- Sau migration: `pnpm db:types`, thêm/cập nhật test pgTAP trong `supabase/tests/`.
- `supabase/config.toml`: chặn tự đăng ký bằng `[auth] enable_signup = false`; **giữ** `[auth.email] enable_signup = true` (đặt false sẽ tắt luôn đăng nhập email).
