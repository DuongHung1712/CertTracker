# Task 9 — Deploy foundation lên gói miễn phí

Supabase Free (database + auth) và Vercel Hobby (Next.js). Quyết định: `docs/decisions.md` #13.

**Trạng thái (2026-09-27):** đã deploy — production `https://cert-tracker-three.vercel.app`, Supabase region Tokyo (`ap-northeast-1`), smoke test đạt.

> [!WARNING]
> Giới hạn của gói miễn phí:
> - **Supabase Free tạm dừng project sau 7 ngày không có truy cập**, bấm *Restore* trong dashboard để chạy lại (vài phút). Không có backup tự động.
> - **Vercel Hobby chỉ dành cho mục đích phi thương mại.** Chuyển Next.js sang VPS (hoặc Vercel Pro) trước khi team dùng chính thức.
> - Không nhập dữ liệu nhân sự thật cho tới khi có backup.

Thứ tự: **A → B → C → D → E**. Mỗi bước có mục *Kiểm tra* — chưa đạt thì đừng đi tiếp.

---

## A. Đưa code lên `main`

Vercel deploy bản chính thức từ nhánh `main`.

1. Merge PR `feat/phase1-week1-foundation` → `dev` (CI phải xanh).
2. Mở PR `dev` → `main`, merge.

**Kiểm tra:** trên GitHub, nhánh `main` có thư mục `src/` và `supabase/`.

---

## B. Supabase Cloud

### B1. Tạo project

1. Đăng nhập <https://supabase.com/dashboard> → **New project**.
2. Điền:
   - **Name:** `certtracker`
   - **Database password:** bấm *Generate*, **lưu vào trình quản lý mật khẩu** (cần ở bước B2; không commit, không dán vào chat).
   - **Region:** Southeast Asia (Singapore).
   - **Plan:** Free.
3. Đợi project khởi tạo xong (1–2 phút).
4. Ghi lại **Project ref**: chuỗi ký tự trong URL `https://supabase.com/dashboard/project/<project-ref>`.

### B2. Đẩy schema lên (chạy trên máy, trong thư mục repo, đang ở `main`)

```bash
pnpm supabase login
```
Trình duyệt mở ra để cấp quyền cho CLI.

```bash
pnpm supabase link --project-ref <project-ref>
```
Nhập **Database password** ở B1 khi được hỏi.

```bash
pnpm supabase db push
```
CLI liệt kê 4 migration (`20260928000001` → `20260928000004`), gõ `Y` để xác nhận.

> [!CAUTION]
> - Chỉ dùng `db push`. **Không** chạy `supabase config push` — nó đẩy cấu hình local (Site URL `localhost`…) lên Cloud.
> - `seed.sql` **không** được đẩy lên Cloud — đúng ý đồ, Cloud không có user test.
> - Không bao giờ chạy `supabase db reset --linked` — lệnh này xóa sạch DB trên Cloud.

**Kiểm tra:** dashboard → **Table Editor** thấy 10 bảng (`dcs`, `programs`, `teams`, `members`, `profiles`, `team_managers`, `cert_types`, `providers`, `courses`, `training_records`), mỗi bảng có nhãn **RLS enabled**.

### B3. Cấu hình đăng nhập

Dashboard → **Authentication**:

1. **Sign In / Providers**
   - *Allow new users to sign up*: **Tắt**.
   - Provider **Email**: **Bật** (tắt Email sẽ không ai đăng nhập được).
   - *Confirm email*: để mặc định.
2. **URL Configuration**: để trống, điền ở bước D3.

### B4. Tạo tài khoản admin đầu tiên

App chưa có trang "đặt mật khẩu", nên **không dùng *Invite user*** (link mời sẽ không dùng được).

1. **Authentication → Users → Add user → Create new user**.
2. Nhập email thật của bạn và một mật khẩu mạnh, **tick *Auto Confirm User***.
3. **SQL Editor** → chạy:

```sql
update public.profiles
set role = 'admin'
where user_id = (select id from auth.users where email = '<email-cua-ban>');
```

**Kiểm tra:** chạy tiếp

```sql
select u.email, p.role
from public.profiles p
join auth.users u on u.id = p.user_id;
```
→ đúng 1 dòng, `role = admin`.

### B5. Lấy key cho Vercel

**Project Settings → API Keys** (hoặc **Data API**), ghi lại:
- **Project URL** → dùng cho `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → dùng cho `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> [!CAUTION]
> **Không** lấy `service_role` / `secret` key. App chưa cần; key đó vượt qua RLS.

---

## C. Vercel

### C1. Tạo project

1. <https://vercel.com/signup> → **Continue with GitHub** → gói **Hobby**.
2. **Add New… → Project** → chọn repo `CertTracker` → **Import**.
3. Màn hình cấu hình:
   - **Framework Preset:** Next.js (tự nhận).
   - **Root Directory:** `./`
   - **Build / Install command:** để mặc định (Vercel tự nhận pnpm từ `pnpm-lock.yaml`).
   - **Environment Variables:** thêm 2 biến ở B5:

     | Key | Value |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
4. **Deploy**.

**Kiểm tra:** build xanh; có domain dạng `https://certtracker-xxxx.vercel.app`.

### C2. Nhánh production

**Settings → Git → Production Branch** = `main`. Push vào nhánh khác (`dev`, `feat/*`) chỉ tạo bản *Preview*.

---

## D. Nối Supabase với domain Vercel

Dashboard Supabase → **Authentication → URL Configuration**:

1. **Site URL:** `https://certtracker-xxxx.vercel.app`
2. **Redirect URLs:** thêm `https://certtracker-xxxx.vercel.app/**`

---

## E. Smoke test

Trên domain Vercel, dùng cửa sổ ẩn danh:

| Thao tác | Kết quả đúng |
|---|---|
| Mở `/` | Chuyển về `/login` |
| Đăng nhập sai mật khẩu | "Email hoặc mật khẩu không đúng" |
| Đăng nhập tài khoản B4 | Vào `/dashboard`, thấy `Vai trò: admin` |
| Bấm **Đăng xuất**, rồi mở `/dashboard` | Bị đưa về `/login` |

Xong → cập nhật trạng thái trong `CLAUDE.md` và tick *Tuần 1* trong `README.md` (plan Task 9, Step 6).

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `db push` báo lỗi kết nối / sai mật khẩu | Sai Database password | Dashboard → **Project Settings → Database → Reset database password**, chạy lại `supabase link` |
| Vercel build lỗi ở bước `pnpm install` do phiên bản pnpm | Vercel chưa dùng đúng pnpm 11 trong `packageManager` | Thêm env `ENABLE_EXPERIMENTAL_COREPACK=1` rồi *Redeploy* |
| Đăng nhập báo `Email logins are disabled` | Provider Email bị tắt | Bật lại ở B3 |
| Đăng nhập đúng nhưng Dashboard hiện `Vai trò: member` | Chưa chạy SQL ở B4 | Chạy lại SQL, đăng xuất → đăng nhập |
| Trang báo lỗi 500 ngay khi mở | Thiếu/sai env trên Vercel | Kiểm tra 2 biến ở C1, *Redeploy* |
| Project Supabase "Paused" | Free tier không hoạt động 7 ngày | Dashboard → **Restore project** |
| `404` ở đường dẫn `/rest/v1/auth/v1/token` | `NEXT_PUBLIC_SUPABASE_URL` bị thêm `/rest/v1` | Chỉ để `https://<project-ref>.supabase.co`, không có đường dẫn phía sau |
| Lỗi DNS / `fetch failed` tới `*.supabase.co` | Gõ sai project ref trong URL | Copy lại Project URL từ dashboard, *Redeploy* |
| Vercel cảnh báo biến `NEXT_PUBLIC_*` là Sensitive | Biến public không được đặt kiểu Sensitive | Đặt kiểu thường (plaintext) — giá trị này vốn công khai ở client |
