# Phản hồi của manager: bộ tài liệu quy trình, độ trễ chuyển trang, ngôn ngữ giao diện — Design Spec

- **Ngày:** 2026-10-05
- **Trạng thái:** Đã duyệt thiết kế trong chat (3 phần), chờ review spec
- **Nguồn:** phản hồi của manager về CertTracker (3 nhận xét + đề xuất quy trình), `CertTracker - Feature List.pdf`, spec `2026-09-26-certtracker-design.md`, `docs/decisions.md`

---

## 1. Bối cảnh

Manager xem bản Vercel của CertTracker và nhận xét:

1. App bị **chậm/lag khi chuyển tab** (phải chờ loading). *(Ban đầu bị hiểu nhầm là trễ tiến độ; người dùng đã làm rõ.)*
2. Không rõ **requirements** làm nền cho app là gì.
3. Giao diện **toàn tiếng Việt**, một số thuật ngữ kỹ thuật bị dịch nên khó hiểu.

Mối lo lớn nhất: **requirements và WBS**. Manager đề xuất quy trình để bảo vệ công sức, tránh build thứ không giải quyết nhu cầu thật:

> Idea → Brainstorm → CA → WBS → SAD → Design/Mockup → PoC → MVP → Production
> "Build the right thing before building the thing right."

**Hiện trạng thật:** dự án đi theo thứ tự "có Feature List + spec thiết kế → build ngay". Feature List là danh sách tính năng (giải pháp), không phải phân tích nhu cầu. Chưa có CA, WBS. Spec 2026-09-26 đóng vai trò SAD nhưng chưa được trình bày như vậy. Nhu cầu chưa được xác nhận với người dùng cuối (Feature List do manager/lead giao).

## 2. Phân rã: ba hướng độc lập

| # | Hướng | Giao nộp | Cách xử lý |
|---|---|---|---|
| 1 | Độ trễ khi chuyển trang | Chẩn đoán có số đo + sửa nhỏ | Spike đã làm (mục 3); sửa là thay đổi riêng, cần duyệt |
| 2 | Bộ tài liệu theo quy trình của manager | `docs/process/` (mục 4) | Việc chính của spec này |
| 3 | Ngôn ngữ giao diện | i18n EN/VI có công tắc | Dự án con riêng, cần brainstorm → spec → plan của nó; vào WBS như một work package |

## 3. Hướng 1 — Kết quả spike độ trễ (chỉ đọc, đã thực hiện)

**Đã đo (production, request chưa đăng nhập, 2026-10-05):** máy chủ biên ở Singapore (`x-vercel-id: sin1::…`). `/login` (cache) trả về trong 0,26–0,45 s (đôi lần 1,2–1,9 s do kết nối lần đầu); các route cần đăng nhập trả 307 về `/login` trong ~0,25 s. Phần mạng/biên không phải nguyên nhân.

**Chưa đo được:** thời gian hàm phía server cho trang đã đăng nhập (cần phiên đăng nhập). Ba giả thuyết dựa trên code và tài liệu deploy:

| Giả thuyết | Căn cứ | Mức tin |
|---|---|---|
| Hàm Vercel chạy ở US East, Supabase ở Tokyo (~150–200 ms/lần gọi) | `docs/deploy/task9-free-tier.md` (Supabase Tokyo); repo không đặt vùng cho hàm | Cao, cần kiểm tra bằng `x-vercel-id` của một request `_rsc` đã đăng nhập |
| Mỗi lần chuyển trang gọi Supabase nối tiếp ≥ 3 lần trước truy vấn của trang | `proxy.ts` → `auth.getUser()`; `getCurrentUser` → `auth.getUser()` + đọc `profiles` | Cao (đã đọc code) |
| Thiếu `loading.tsx` ở hầu hết các trang `(app)` | Trên `dev` chỉ `dashboard/loading.tsx` tồn tại | Cao (đã kiểm tra) |

**Khuyến nghị (chưa thực hiện, cần duyệt):** (1) đặt vùng hàm về Tokyo (`hnd1`) hoặc Singapore (`sin1`); (2) thêm `loading.tsx` cho mọi trang trong `(app)`; (3) bỏ lần gọi Auth thừa (`getClaims` hoặc một lần `getUser`). Tiêu chí hoàn thành: đo lại cùng phương pháp, ghi số trước/sau vào `02-wbs.md`.

## 4. Hướng 2 — Bộ tài liệu `docs/process/` (tiếng Anh)

Quyết định: **tiếng Anh là ngôn ngữ chính** (manager phản hồi bằng tiếng Anh); thuật ngữ kỹ thuật giữ nguyên gốc; mỗi tài liệu mở đầu bằng tóm tắt tiếng Việt ngắn cho người soạn. Nằm trong repo, tái dùng `spec`, `decisions.md`, `plans/` thay vì chép lại; sau đó xuất một bản đọc được cho manager.

### 4.1 `00-process-status.md`
Đối chiếu chuỗi của manager với hiện trạng thật, **không tô vẽ**:

| Giai đoạn | Hiện trạng |
|---|---|
| Idea | Xong: Feature List từ DC34 |
| Brainstorm | Xong: spec 2026-09-26 và `decisions.md` |
| CA | **Thiếu** — bù bằng `01`, nêu rõ nhu cầu chưa xác nhận với người dùng cuối |
| WBS | **Thiếu** — bù bằng `02` |
| SAD | Có dưới dạng spec; `03` rút gọn |
| Design/Mockup | Xong: design system, trang `/design` |
| PoC / MVP | MVP nội bộ đã build (tuần 1–6), **chưa xác nhận bởi người dùng cuối** (chưa chạy file Excel thật, chưa UAT) |
| Production | Chưa: Vercel Hobby + Supabase Free |

Tài liệu nói thẳng: đã build trước, tài liệu bù sau. Có **Cổng G1**: Giai đoạn 2 (AI, tuần 7–12) chỉ mở khi các giả định then chốt đã được xác nhận bằng phỏng vấn người dùng và chạy file Excel thật.

### 4.2 `01-requirements-and-ca.md` (Concept/Customer Analysis)
Bảy mục:

1. **Problem statement** — vấn đề dự kiến (dữ liệu lỗi thời, không cảnh báo hạn, khó tổng hợp); mỗi ý gắn nhãn *Assumed* tới khi được xác nhận.
2. **Stakeholders và người dùng** — Sponsor, Admin, Manager, Member; mỗi nhóm có job-to-be-done.
3. **Hiện trạng và phương án thay thế** — giữ Excel + nhắc thủ công / công cụ có sẵn (ví dụ SkillMatrix) / tự build; lý do chọn tự build lúc đó.
4. **Requirements** — bảng `R-01…`: nguồn · ưu tiên (Must/Should/Could) · trạng thái build (tuần nào) · trạng thái xác nhận. Gồm 9 nhóm trong Feature List và các yêu cầu phi chức năng (bảo mật RLS, quyền riêng tư của xếp hạng/AI, tiếng Việt có dấu khi export, hiệu năng chuyển trang, ngôn ngữ giao diện).
5. **Tiêu chí thành công đo được** — từ spec: team thật bỏ Excel; import sạch; email thứ Hai chạy đúng 2 tuần liên tiếp. Thêm: ngưỡng thời gian chuyển trang, chốt sau khi đo lại (hướng 1).
6. **Phạm vi có / không** — gồm danh sách YAGNI của spec §11.
7. **Giả định, rủi ro, kế hoạch xác nhận** — mỗi giả định then chốt có cách kiểm chứng và người kiểm chứng; phỏng vấn 3–5 người (1 manager, 1 Admin, 2–3 Member) và thử với file Excel thật; kết quả là điều kiện mở Cổng G1.

Nguyên tắc: không giả vờ có bằng chứng người dùng; chỗ chưa xác nhận ghi rõ *Assumed* kèm cách kiểm chứng.

### 4.3 `02-wbs.md`
Cây công việc có mã (`1.1`, `1.2`…); mỗi work package có deliverable, tiêu chí chấp nhận, ước lượng (ngày), phụ thuộc, trạng thái; cột kế hoạch (từ lộ trình tuần 1–6 của spec) so với thực tế (từ lịch sử git). Phần chưa làm ghi dạng khoảng ước lượng.

| Nhánh | Nội dung | Trạng thái |
|---|---|---|
| 1 | Requirements và quản trị dự án (CA, phỏng vấn, WBS, SAD) | Đang làm |
| 2 | Nền tảng (W1): schema, RLS, đăng nhập, CI, deploy | Xong |
| 3 | CRUD tổ chức và danh mục (W2) | Xong |
| 4 | Training Records (W3): danh sách, form, minh chứng, Realtime | Xong |
| 5 | Import/Export (W4) | Xong, chưa chạy file Excel thật |
| 6 | Dashboard (W5) | Xong |
| 7 | Cron và email (W6): nhắc hạn, báo cáo tháng, chất lượng dữ liệu | Code xong trên nhánh `feat/week6-notifications`, chưa merge/deploy |
| 8 | Xuyên suốt: hiệu năng chuyển trang, i18n EN/VI, đăng ký tự phục vụ/SSO | Chưa bắt đầu (hiệu năng: đã chẩn đoán) |
| 9 | Xác nhận và triển khai: file Excel thật, xác minh domain gửi mail, UAT một team, hosting chính thức | Chưa bắt đầu |
| **G1** | **Cổng: nhu cầu đã được xác nhận** | Chờ nhánh 1 và 9 |
| 10 | Giai đoạn 2 — AI (W7–12) | Bị khóa tới khi qua G1 |

### 4.4 `03-sad.md`
Bản ~3–4 trang rút từ spec, kèm sơ đồ Mermaid: (1) Context; (2) Container — Next.js trên Vercel, Supabase (Postgres, Auth, Storage, Realtime), Vercel Cron, Resend; (3) Data model (ER tổng quan); (4) Bảo mật — ma trận vai trò, RLS là lớp chính, service role chỉ cho cron; (5) Luồng chính — import Excel, cron + email (chống gửi trùng); (6) Thuộc tính chất lượng — hiệu năng (kèm phát hiện vùng chạy Vercel/Supabase), quyền riêng tư, độ tin cậy; (7) Triển khai hiện tại và hướng chuyển VPS (decisions #13); (8) Chỉ mục quyết định (trỏ `decisions.md`) và nợ kỹ thuật đã biết.

## 5. Hướng 3 — Ngôn ngữ giao diện (quyết định đã chốt)

Người dùng chọn **hỗ trợ cả hai ngôn ngữ (i18n, công tắc EN/VI)**, thay thế quyết định "chỉ tiếng Việt" ở spec §11 và hạng mục YAGNI tương ứng. Đây là **dự án con riêng**, không làm trong spec này. Cần quyết định riêng: thư viện i18n, ngôn ngữ mặc định, ngôn ngữ email theo người nhận, định dạng ngày/số, cách xử lý dữ liệu do người dùng nhập (tên khóa học giữ nguyên). Vào WBS nhánh 8; ghi vào `decisions.md` khi spec riêng được duyệt. Trong lúc chờ, bảng thuật ngữ EN/VI sẽ nằm trong `01` (phần requirements phi chức năng).

## 6. Phạm vi và việc ngoài phạm vi

- **Trong phạm vi:** viết `00`–`03`; ghi quyết định mới vào `decisions.md`; cập nhật `CLAUDE.md` (bảng "Nguồn sự thật" thêm `docs/process/`); soạn tin nhắn trả lời manager (trong chat, không phải file).
- **Ngoài phạm vi:** sửa code hiệu năng; i18n; phỏng vấn người dùng (việc của người dùng, tài liệu chỉ cung cấp kế hoạch); bất kỳ thay đổi nào ở Giai đoạn 2.

## 6.1 Quyết định mới cần ghi vào `decisions.md` khi spec được duyệt

1. Thêm CA, WBS, SAD (rút gọn) vào bộ tài liệu dự án và dùng chuỗi quy trình của manager làm khung; tài liệu bù sau vì dự án đã build trước.
2. Cổng G1 trước Giai đoạn 2.
3. Tài liệu quy trình viết bằng tiếng Anh, nằm ở `docs/process/`.
4. Thay quyết định "chỉ tiếng Việt" bằng "i18n EN/VI" (thiết kế riêng).

## 7. Tiêu chí hoàn thành

- 4 file `docs/process/00`–`03` tồn tại, mỗi requirement có ID/nguồn/trạng thái, mỗi giả định chưa xác nhận có cách kiểm chứng.
- `02-wbs.md` có cột kế hoạch so với thực tế và Cổng G1.
- `03-sad.md` có sơ đồ Mermaid hiển thị được trên GitHub.
- `decisions.md` có 4 quyết định ở mục 6.1; `CLAUDE.md` trỏ tới `docs/process/`.
- Tin nhắn trả lời manager được soạn và người dùng duyệt.

## 8. Bước tiếp theo

1. Người dùng duyệt spec này.
2. Viết kế hoạch triển khai (writing-plans) cho bộ tài liệu.
3. Song song, người dùng cung cấp `x-vercel-id` của một request `_rsc` đã đăng nhập để xác nhận giả thuyết vùng chạy; sau đó quyết định làm sửa hiệu năng (thay đổi riêng).
4. Sau đó: brainstorm riêng cho i18n.
