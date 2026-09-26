# Decision Log

Quyết định đã chốt. Thêm mục mới ở cuối; không sửa mục cũ — nếu đổi ý, thêm mục mới ghi "thay thế #N".

| # | Ngày | Quyết định | Lý do / phương án đã loại |
|---|---|---|---|
| 1 | 2026-09-26 | Hosting trên cloud SaaS: Supabase Cloud + Vercel | Dữ liệu được phép lưu cloud; nhanh nhất, ít vận hành |
| 2 | 2026-09-26 | Vai trò Admin / Manager / Member | Member tự cập nhật tiến độ & minh chứng; loại "chỉ admin nhập" |
| 3 | 2026-09-26 | Cơ cấu DC → Program → Team (cha-con); member thuộc 1 team, manager quản lý nhiều team | Khớp tổ chức thật; nhiều team/member là YAGNI |
| 4 | 2026-09-26 | Team 1–2 người, toàn bộ TypeScript | Loại FastAPI riêng cho AI, loại backend Java/.NET/NestJS |
| 5 | 2026-09-26 | Kiến trúc: Next.js fullstack + Supabase, RLS là lớp bảo mật chính | Loại SPA + Edge Functions (hạn chế thư viện); loại ORM + Supabase-chỉ-Postgres (mất RLS/Realtime) |
| 6 | 2026-09-26 | AI dùng LLM bên thứ ba qua API key, gọi từ server qua Vercel AI SDK | Provider-agnostic; key không lộ ra client |
| 7 | 2026-09-26 | Lưu file minh chứng ở Supabase Storage, sau interface `FileStorage` | Loại Cloudinary: phải tự làm lớp phân quyền thứ 2, PDF bị chặn mặc định ở free tier |
| 8 | 2026-09-26 | Xếp hạng cá nhân chỉ Manager/Admin xem | Quyền riêng tư; Member chỉ thấy KPI tổng hợp ẩn danh |
| 9 | 2026-09-26 | Ask Your Data dùng query spec whitelist, không text-to-SQL tự do | Loại SQL injection và truy vấn vượt RLS |
| 10 | 2026-09-26 | Ngưỡng expiry: Expiring Soon ≤ 30 ngày, Expiring in 60d ≤ 60 ngày | Feature list chưa định nghĩa; có thể điều chỉnh |
| 11 | 2026-09-26 | Import Excel: số serial Excel được **chuyển** thành ngày, không xóa dòng | Diễn giải "loại bỏ ngày dạng serial" theo hướng giữ dữ liệu |
| 12 | 2026-09-26 | Đăng nhập email + mật khẩu, tắt tự đăng ký; admin tạo tài khoản | Chỉ nhân sự nội bộ được dùng; SSO bổ sung sau như một provider |

