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
| 13 | 2026-09-27 | Giai đoạn foundation dùng gói **miễn phí**: Vercel Hobby + Supabase Free; sau này chuyển Next.js sang VPS (Docker), Supabase vẫn ở Cloud | Chi phí 0 khi thử nghiệm. Chấp nhận: Supabase Free tạm dừng sau 7 ngày không hoạt động và không có backup; Vercel Hobby không dành cho mục đích thương mại — chuyển trước khi dùng chính thức. Bổ sung #1 |
| 14 | 2026-09-27 | Design system riêng: hướng "hồ sơ chứng chỉ" (teal đậm trên nền giấy) + bảng compact; chỉ giao diện sáng, token theo vai trò; sidebar trái lọc theo vai trò. Chi tiết: `docs/design-system.md` | Không có brand guideline công ty. Loại hướng "bảng điều khiển" (khô với member) và "lộ trình học" (kém nghiêm túc, tốn chỗ ở màn quản trị); loại top nav (chật khi ≥ 7 mục) |
| 15 | 2026-09-30 | Mỗi thành viên chỉ có **một bản ghi cho mỗi khóa học** (`unique (member_id, course_id)`); gia hạn = sửa `issued_date` trên cùng bản ghi | Cho import tuần 4 một khóa tự nhiên để tạo/cập nhật; chặn nhập trùng. Lịch sử thay đổi nằm ngoài phạm vi (spec §11) |
| 16 | 2026-09-30 | Ngày nhập tay dạng `dd/mm/yyyy` trong ô text, không có lịch chọn ngày | Không thêm phụ thuộc, không lỗi múi giờ, nhập bàn phím nhanh, dễ test. Thay hàng `DatePicker` trong design system |
| 17 | 2026-09-30 | Minh chứng: PDF/JPEG/PNG/WebP, tối đa 4 MB, tải lên qua Server Action | Vercel từ chối request body > 4,5 MB. Loại tệp xác định bằng magic bytes, không tin MIME do trình duyệt gửi |
| 18 | 2026-09-30 | `issued_date` không được ở tương lai (quy tắc ở tầng ứng dụng, tính theo "hôm nay" giờ VN) | Ngày cấp tương lai làm ngày hết hạn sai |
| 19 | 2026-09-30 | Không dùng optimistic locking — người ghi sau thắng | Realtime làm màn hình cũ nhanh chóng được làm mới; giao diện xử lý xung đột là YAGNI ở quy mô team này |
| 20 | 2026-10-01 | `commit_import` là **`SECURITY INVOKER`**, tự kiểm tra `app_role() = 'admin'`; không dùng service-role key ở bất kỳ đâu. **Thay thế** spec §5 ("service role … commit import") | Admin đã có đủ quyền RLS trên mọi bảng bị ghi. Bớt một secret, RLS vẫn có hiệu lực |
| 21 | 2026-10-01 | **Ô trống = "không cung cấp" = giữ giá trị hiện có.** Import không đổi tên thành viên, không chuyển team, không sửa thuộc tính danh mục của khóa học đã có, không tạo team. Import chỉ tạo thành viên, nhà cung cấp, loại chứng chỉ và khóa học còn thiếu | Import không được âm thầm phá dữ liệu đã chỉnh tay. Team là cơ cấu tổ chức do admin quản lý |
| 22 | 2026-10-01 | **Trạng thái thắng tiến độ** khi hai cột mâu thuẫn (mỗi trường hợp có cảnh báo hiển thị trong preview). Bản ghi đã hoàn thành mà thiếu ngày cấp là lỗi — ứng dụng không tự bịa ngày | Người dùng cập nhật trạng thái; tiến độ hay bị trôi |
| 23 | 2026-10-01 | **Chế độ cột tiến độ quyết định một lần cho cả file:** nếu mọi ô số đều trong 0–1 thì cột là phân số (`0.75` → 75%), ngược lại là phần trăm. Chuỗi `"45%"` luôn là phần trăm. Preview cho biết chế độ đã dùng | Ô định dạng phần trăm trong Excel được đọc ra dưới dạng phân số |
| 24 | 2026-10-01 | **Dòng có lỗi bị bỏ qua; bản thân lần commit là tất cả hoặc không gì cả;** tối đa **2000** dòng dữ liệu và **4 MB** mỗi file; chỉ nhận `.xlsx`/`.xls` | Spec: "1 transaction". 2000 dòng nằm trong statement timeout 8 giây của Supabase cho `authenticated`; 4 MB nằm dưới giới hạn body 4,5 MB của Vercel |
| 25 | 2026-10-01 | Trong một file, **cùng thành viên + khóa học hai lần là lỗi ở dòng sau**. Danh tính thành viên = email viết thường, đã cắt khoảng trắng (như `dedupeMembersByEmail` của spec); thành viên mới xuất hiện nhiều dòng lấy tên và team của dòng đầu | Hai phiên bản của một bản ghi trong cùng file là vấn đề dữ liệu admin phải tự giải quyết |
| 26 | 2026-10-01 | **Export:** CSV = UTF-8 BOM, dấu phẩy, CRLF, ngày `dd/mm/yyyy`, chặn công thức độc hại (formula injection). `.xlsx` = ô ngày thật (`dd/mm/yyyy`), tiến độ là phân số định dạng phần trăm. File `.xlsx` đã xuất nhập lại được với **0 thay đổi** | Tiếng Việt mở đúng trong Excel; nhập lại nguyên file là phép thử đúng đắn mạnh |
| 27 | 2026-10-01 | SheetJS cài từ **`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`**, không lấy từ npm registry | Bản `xlsx` trên npm dừng ở 0.18.5 và có lỗ hổng đã biết (prototype pollution, ReDoS) |
