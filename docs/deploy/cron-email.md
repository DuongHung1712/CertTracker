# Cron và email tự động (tuần 6)

Hai việc chạy định kỳ, do Vercel Cron gọi (quyết định: `docs/decisions.md` #34–#40):

| Route | Lịch (UTC) | Giờ Việt Nam | Gửi gì |
|---|---|---|---|
| `GET /api/cron/expiry-alerts` | `0 1 * * 1` | 08:00 thứ Hai | Nhắc chứng chỉ hết hạn trong 60 ngày (và vừa hết hạn trong 30 ngày) cho Manager (team mình) và Member (của mình) |
| `GET /api/cron/monthly-report` | `0 1 1 * *` | 08:00 ngày 1 | Báo cáo KPI của tháng trước cho Manager (team mình) và Admin (toàn đơn vị) |

Lịch nằm trong `vercel.json`. Mỗi người nhận tối đa một email mỗi loại mỗi kỳ; kết quả từng lần gửi ghi vào bảng `notification_log` và hiện ở **Cài đặt** (chỉ Admin).

> [!WARNING]
> - **Domain gửi phải được xác minh trên Resend trước khi dùng thật** (mục 1). Người gửi sandbox `onboarding@resend.dev` chỉ gửi được cho chủ tài khoản Resend; mọi người khác bị Resend từ chối.
> - `SUPABASE_SERVICE_ROLE_KEY` vượt qua RLS. Chỉ đặt ở biến môi trường server (Vercel), **không bao giờ** thêm tiền tố `NEXT_PUBLIC_`, không dán vào chat hay commit.

---

## 1. Resend

1. Tạo tài khoản tại <https://resend.com>.
2. **Domains → Add Domain**: nhập domain dùng để gửi (vd. `mail.example.com`).
3. Thêm các bản ghi DNS Resend hiển thị vào nhà cung cấp DNS của domain: **SPF** (TXT), **DKIM** (TXT/CNAME) và, nên có, DMARC. Bấm *Verify*; trạng thái phải là **Verified** (có thể mất vài phút tới vài giờ).
4. **API Keys → Create API Key** (quyền *Sending access*), lưu vào trình quản lý mật khẩu.
5. Địa chỉ gửi (`EMAIL_FROM`) phải thuộc domain đã xác minh, dạng `CertTracker <noreply@mail.example.com>`.

Gói Resend miễn phí: 100 email/ngày, 3.000 email/tháng, 2 request/giây (code đã giãn ≥ 600 ms giữa hai lần gửi).

**Kiểm tra:** trên Resend, domain ở trạng thái *Verified*.

## 2. Biến môi trường trên Vercel (Production)

Project → Settings → Environment Variables, môi trường **Production**:

| Biến | Giá trị |
|---|---|
| `RESEND_API_KEY` | API key ở bước 1 |
| `EMAIL_FROM` | `CertTracker <noreply@<domain-da-xac-minh>>` |
| `APP_URL` | URL production, không dấu `/` cuối (vd. `https://cert-tracker-three.vercel.app`); dùng cho liên kết trong email |
| `CRON_SECRET` | Chuỗi ngẫu nhiên **từ 16 ký tự** (vd. `openssl rand -hex 24`). Khi biến này tồn tại, Vercel tự gắn `Authorization: Bearer <CRON_SECRET>` vào mỗi lần gọi cron |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**bí mật**) |

**Không** đặt `EMAIL_TRANSPORT=console` ở Production (code từ chối). Đổi biến xong phải **Redeploy** để có hiệu lực.

**Kiểm tra:** đăng nhập bằng Admin, mở **Cài đặt**: khối "Cấu hình" hiển thị "Đã cấu hình" cho cả 5 mục (trang chỉ cho biết có hay chưa, không hiện giá trị).

## 3. Đẩy migration tuần 6 lên Supabase Cloud

Hai migration mới (chỉ *thêm*, code cũ vẫn chạy khi DB lên trước):

- `20261004000001_data_quality_view.sql`
- `20261004000002_notifications.sql`

**Thứ tự: DB trước, code sau** (trang Chất lượng dữ liệu và cron cần view/hàm mới).

```bash
pnpm supabase migration list      # hai dòng trên có Local, Remote trống
pnpm supabase db push --dry-run   # chỉ liệt kê
pnpm supabase db push             # gõ Y để xác nhận
pnpm supabase migration list      # Local và Remote khớp hết
```

Không chạy `supabase db reset --linked` và `supabase config push` (xem quy trình đầy đủ trong tài liệu đẩy migration của dự án).

## 4. Vercel Cron: những điều cần biết

- Cron **chỉ chạy trên deployment Production** (không chạy ở Preview). Lịch cập nhật sau mỗi lần deploy production.
- Gói **Hobby**: tối đa **một lần/ngày** cho mỗi cron và giờ chạy có thể **lệch tới ~1 giờ** trong khung giờ đã đặt. Lịch của ta là tuần/tháng nên ổn.
- Vercel gọi bằng `GET`, không theo chuyển hướng, và coi phản hồi không phải 2xx là "failed" (route cố ý trả HTTP 500 khi có người gửi lỗi để dashboard cron hiện đỏ).
- Có thể bị kích hoạt trùng hoặc không tự thử lại; vì vậy route **idempotent**: người đã nhận trong kỳ đó bị bỏ qua.
- Log: Vercel → project → **Logs** (lọc `/api/cron`) và **Settings → Cron Jobs** (nút *Run* để chạy ngay).

## 5. Chạy thử thủ công

Luôn bắt đầu bằng `dryRun=1`: chỉ liệt kê người nhận, **không claim, không gửi, không ghi log**.

```bash
export CRON_SECRET='<giá trị trên Vercel>'
# 1) xem ai sẽ nhận
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<domain>/api/cron/expiry-alerts?dryRun=1"
# 2) gửi thật (bỏ dryRun); gọi lại bao nhiêu lần cũng an toàn
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<domain>/api/cron/expiry-alerts"
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<domain>/api/cron/monthly-report"
```

Trên Windows PowerShell dùng `curl.exe` và `$env:CRON_SECRET`.

### Đọc kết quả

Phản hồi JSON có các trường:

| Trường | Ý nghĩa |
|---|---|
| `job`, `period` | Loại và kỳ (`2026-W41` cho nhắc hạn theo tuần ISO; `2026-09` cho báo cáo tháng = tháng trước) |
| `transport` | `resend` (gửi thật) hoặc `console` (chỉ in log; không bao giờ dùng ở production) |
| `dryRun` | `true` nếu chỉ liệt kê |
| `planned` | Số người sẽ nhận trong kỳ này |
| `sent` | Đã gửi thành công trong lần gọi này |
| `skipped` | Đã gửi từ lần gọi trước trong cùng kỳ, nên bỏ qua |
| `inFlight` | Có lần chạy khác đang giữ quyền gửi (hoặc lần chạy trước bị chết giữa chừng) |
| `failed`, `failures[]` | Số lỗi và `{ email, error }` từng người; HTTP trả về là 500 |
| `truncated` | `true` nếu hết ngân sách 50 giây trước khi xử lý hết |
| `undeliverable[]` | Địa chỉ bị loại vì không hợp lệ (không gửi, không tính vào `planned`) |
| `warnings[]` | Cảnh báo từng người (vd. không ghi được log) |
| `recipients[]` | Chỉ khi `dryRun`: `{ email, detail }` từng người nhận |

Quy tắc đọc:

- `sent + skipped + inFlight + failed = planned` (trừ phần chưa xử lý nếu `truncated`).
- **`truncated: true` → gọi lại** để gửi nốt phần còn lại (người đã gửi bị `skipped`).
- **`inFlight > 0` → lần chạy khác đang giữ quyền gửi (hoặc lần chạy trước đã chết); chạy lại sau ~15 phút.** HTTP vẫn là 200 (cố ý: đây không phải lỗi).
- `failed > 0` → xem `failures[]`, sửa nguyên nhân rồi gọi lại; chỉ những người lỗi được gửi lại.
- Không có gì để báo (không ai có chứng chỉ sắp hết hạn) → `planned: 0`, không gửi email, không ghi log.

## 6. Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `500 {"error":"cron-not-configured"}` | `CRON_SECRET` thiếu hoặc ngắn hơn 16 ký tự. Đặt lại rồi Redeploy |
| `401 {"error":"unauthorized"}` | Sai token hoặc thiếu header `Authorization: Bearer …`. Phiên đăng nhập của trình duyệt **không** thay được token |
| `405` | Route chỉ nhận `GET` |
| `500 {"error":"email-not-configured","detail":…}` | Production thiếu `RESEND_API_KEY` hoặc `EMAIL_FROM` (hoặc đặt `EMAIL_TRANSPORT=console`). Route dừng **trước khi** claim nên không mất kỳ gửi nào |
| `500 {"error":"internal"}` | Lỗi không lường trước (thường là DB/service role key sai hoặc migration chưa đẩy). Xem Vercel Logs |
| `failures[].error` có `403` / "domain is not verified" / "can only send testing emails to your own email" | Domain gửi chưa xác minh hoặc `EMAIL_FROM` không thuộc domain đã xác minh (mục 1) |
| `failures[].error` có `429` | Vượt giới hạn Resend (2 req/s hoặc hạn mức ngày). Chờ rồi gọi lại |
| `inFlight > 0` kéo dài | Chờ ~15 phút rồi chạy lại; claim treo tự được nhận lại sau thời gian đó |
| Email vào thư rác | Kiểm tra SPF/DKIM/DMARC ở Resend; đừng dùng domain chưa có lịch sử gửi cho đợt lớn |
| Cài đặt báo "Chưa cấu hình" dù đã đặt biến | Biến đổi xong chưa Redeploy, hoặc đặt nhầm môi trường (Preview thay vì Production) |

## 7. Khi chuyển sang VPS (quyết định #13)

Route không phụ thuộc Vercel. Trên VPS, dùng cron hệ thống hoặc GitHub Actions gọi **cùng URL với cùng header**:

```cron
0 1 * * 1  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/expiry-alerts
0 1 1 * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/monthly-report
```

Đặt lịch theo UTC (hoặc đặt múi giờ của cron là `Asia/Ho_Chi_Minh` và đổi 01:00 thành 08:00). Cần `curl -f` hoặc kiểm tra mã HTTP để cron của VPS cũng báo lỗi khi route trả 500. Xóa `crons` khỏi `vercel.json` nếu không còn dùng Vercel Cron, để tránh chạy đôi.

## 8. Tiêu chí chấp nhận (cuối giai đoạn 1)

Email thứ Hai chạy đúng **2 tuần liên tiếp**. Kiểm tra trên **Cài đặt** (Admin): dòng "Nhắc hạn chứng chỉ" của hai kỳ tuần liền nhau (vd. `tuần 41/2026` và `tuần 42/2026`) đều có cột "Đã gửi" > 0 và "Lỗi" = 0 (và "Đang gửi" = 0). Báo cáo tháng: dòng "Báo cáo tháng" của tháng vừa qua cũng "Lỗi" = 0.

---

## UAT với một team thật (việc của người dùng, không phải của agent)

Mục tiêu: xác nhận người thật nhận được email đúng, đúng giờ, dữ liệu đúng. Làm sau khi domain Resend đã xác minh (mục 1) và các biến ở mục 2 đã đặt.

1. **Chọn một team và một manager** sẵn lòng thử (nên là team 5–15 người).
2. **Nhập dữ liệu thật:** Admin import file Excel thật của team ở trang *Import / Export* (đã có từ tuần 4), xem trước, nhập, kiểm tra vài dòng với file gốc.
3. **Rà trang Chất lượng dữ liệu** và sửa: bản ghi quá hạn thi, "Done" thiếu minh chứng, thành viên chưa có team, khóa học chưa khai báo thời hạn.
4. **Bảo đảm người nhận có email đúng:** Member nhận qua `members.email`; Manager/Admin qua email tài khoản đăng nhập (đã xác nhận). Tài khoản của manager phải được liên kết với team họ quản lý.
5. **Chạy `dryRun`** cho cả hai route (mục 5): kiểm tra danh sách `recipients` đúng người, `undeliverable` rỗng.
6. **Gửi thật** (bỏ `dryRun`) và đọc phản hồi: `failed = 0`, `truncated = false`.
7. **Hỏi manager và vài member:** có nhận được không (kể cả hộp thư rác)? Nội dung có đúng không (đúng chứng chỉ, đúng số ngày)? Giờ gửi 08:00 thứ Hai có hợp lý? Có cần thêm/bớt thông tin?
8. **Ghi lại vấn đề và quyết định** vào `docs/` (vd. `docs/uat/<ngày>-team-<tên>.md`); thay đổi quyết định thì thêm một mục mới vào `docs/decisions.md`.
9. Theo dõi hai tuần liên tiếp theo mục 8 trước khi mở rộng sang team khác.
