# CertTracker Design System

Tài liệu tham chiếu cho mọi giao diện của CertTracker. Người và AI đọc file này **trước khi dựng UI**.

- **Nguồn sự thật:** code (`src/app/globals.css`, `src/components/**`). File này mô tả và đặt quy tắc; trang Design System trên claude.ai là bản để xem, đồng bộ từ code.
- **Quyết định nền:** `docs/decisions.md` #14.

---

## 1. Nguyên tắc

1. **Hồ sơ chứng chỉ, không phải bảng tính.** Nền giấy trắng ấm, chữ mực xanh đen, một màu nhấn teal đậm — nghiêm túc, đáng tin, vì đây là dữ liệu nhân sự.
2. **Dữ liệu dày, đọc nhanh.** Bảng compact (dòng 32px, chữ 13px), số thẳng cột; khoảng trắng dành cho phân nhóm, không để trang trí.
3. **Trạng thái không bao giờ chỉ dựa vào màu.** Mỗi trạng thái có chữ + icon; màu chỉ tăng tốc độ nhận biết.
4. **Chỉ dùng token.** Không viết màu, cỡ chữ, bo góc cứng trong component — để thêm dark mode sau này không phải sửa component.
5. **Một khung, lọc theo vai trò.** Cùng một app shell cho mọi vai trò; mục không dùng được thì ẩn. Quyền thật do RLS quyết định.

---

## 2. Token

Tên token theo **vai trò**, theo quy ước của shadcn/ui. Chỉ có giao diện sáng; dark mode thêm sau bằng cách khai báo lại cùng tên token (không đổi component).

### 2.1 Màu giao diện

| Token | Giá trị | Dùng cho | Tương phản |
|---|---|---|---|
| `background` | `#F6F7F5` | Nền trang | — |
| `foreground` | `#15212B` | Chữ chính | 15.2:1 trên `background` |
| `card`, `popover` | `#FFFFFF` | Bảng, thẻ, hộp thoại, menu | — |
| `card-foreground`, `popover-foreground` | `#15212B` | Chữ trên thẻ | 16.4:1 |
| `muted`, `secondary` | `#EDF0EE` | Header bảng, nền phụ, nút phụ | — |
| `muted-foreground` | `#56636C` | Chữ phụ, nhãn, placeholder | 5.4:1 trên `muted`, 5.8:1 trên `background` |
| `secondary-foreground` | `#15212B` | Chữ trên nút phụ | 14.2:1 |
| `primary` | `#0E5C58` | Nút chính, link, mục đang chọn, thanh tiến độ | 7.3:1 trên `background` |
| `primary-foreground` | `#FFFFFF` | Chữ trên `primary` | 7.8:1 |
| `primary-hover` | `#0A4744` | Hover nút chính | 10.5:1 với chữ trắng |
| `accent` | `#E2EFEC` | Dòng bảng đang chọn, mục sidebar active, hover dòng | — |
| `accent-foreground` | `#0E5C58` | Chữ trên `accent` | 6.6:1 |
| `destructive` | `#B42318` | Nút xóa, chữ lỗi form | 6.6:1 trên trắng, cả hai chiều |
| `border` | `#D8DEDB` | Đường kẻ bảng, viền thẻ, phân cách (trang trí) | 1.4:1 — không dùng làm ranh giới control |
| `input` | `#83908C` | Viền ô nhập, checkbox, select | 3.3:1 trên `card`, 3.1:1 trên `background` |
| `ring` | `#1C7C75` | Focus ring (2px, offset 2px) | 4.7:1 trên `background` |

Sidebar dùng bộ riêng của shadcn, ánh xạ về các token trên:

| Token | Giá trị |
|---|---|
| `sidebar` | `#FFFFFF` |
| `sidebar-foreground` | `#15212B` |
| `sidebar-border` | `#D8DEDB` |
| `sidebar-accent` / `sidebar-accent-foreground` | `#E2EFEC` / `#0E5C58` |
| `sidebar-primary` / `sidebar-primary-foreground` | `#0E5C58` / `#FFFFFF` |
| `sidebar-ring` | `#1C7C75` |

### 2.2 Màu trạng thái hết hạn

Badge dạng "tem": nền nhạt, chữ đậm, viền 1px. Mỗi trạng thái có 3 token `--status-<id>-fg | -bg | -border`.

| Trạng thái (`expiry_status`) | id | fg | bg | border | Icon (lucide) | Tương phản fg/bg |
|---|---|---|---|---|---|---|
| Active | `active` | `#1D6636` | `#E7F3EB` | `#A8D2B4` | `circle-check` | 6.1:1 |
| Expiring in 60d | `expiring-60` | `#7A5200` | `#FFF5DC` | `#EDCB7E` | `clock` | 6.4:1 |
| Expiring Soon | `expiring-soon` | `#9A3D0B` | `#FDEADD` | `#EFB189` | `triangle-alert` | 5.9:1 |
| Expired | `expired` | `#B42318` | `#FDE8E6` | `#F0ADA7` | `circle-x` | 5.6:1 |
| No Expiry | `no-expiry` | `#4A5560` | `#EEF1F0` | `#D3D9D6` | `infinity` | 6.7:1 |
| N/A | `na` | `#4A5560` | `#EEF1F0` | `#D3D9D6` | `minus` | 6.7:1 |

Màu trạng thái **chỉ** dùng cho hạn chứng chỉ. Không dùng cho nút, trạng thái học hay vai trò.

### 2.3 Chữ

| Vai trò | Font | Ghi chú |
|---|---|---|
| Giao diện | **Be Vietnam Pro** 400/500/600/700 (`latin`, `vietnamese`) | Biến `--font-sans`; số liệu bật `tabular-nums` |
| Mã | **Geist Mono** | Chỉ cho mã thành viên `M001`, mã khóa học |

| Style | Cỡ / dòng / đậm | Dùng cho |
|---|---|---|
| `page-title` | 20 / 28 / 600 | Tiêu đề trang (một `h1` mỗi trang) |
| `section-title` | 15 / 22 / 600 | Tiêu đề khối, tiêu đề hộp thoại |
| `body` | 14 / 20 / 400 | Nội dung, form |
| `table` | 13 / 18 / 400 | Ô bảng |
| `label` | 12 / 16 / 500, chữ hoa, `letter-spacing: 0.04em` | Header cột, nhãn nhóm |
| `caption` | 12 / 16 / 400 | Chú thích, gợi ý dưới ô nhập |
| `kpi` | 28 / 32 / 600, `tabular-nums` | Số lớn trên Dashboard |

### 2.4 Khoảng cách, kích thước, bo góc, bóng

- **Lưới 4px:** `4 · 8 · 12 · 16 · 24 · 32` (Tailwind `1 · 2 · 3 · 4 · 6 · 8`). Nhóm phần tử dùng `gap`, không dùng margin lẻ.
- **Bảng:** dòng 32px, padding ô `6px 10px`, header dính khi cuộn.
- **Control:** cao 32px trong bảng/bộ lọc/toolbar; 36px trong form.
- **Nội dung trang:** padding 24px (16px dưới 640px); form rộng tối đa 640px.

| Bo góc | Giá trị | Dùng cho |
|---|---|---|
| `radius-sm` | 4px | Badge, ô nhập, checkbox |
| `radius-md` | 6px | Nút, thẻ, menu |
| `radius-lg` | 8px | Hộp thoại, sheet |

Bóng đổ chỉ cho lớp nổi (popover, menu, hộp thoại, toast). Thẻ và bảng tách lớp bằng viền `border`.

---

## 3. Component

Component gốc lấy từ **shadcn/ui** (`src/components/ui`, sinh bằng `pnpm dlx shadcn@latest add`). Component riêng của CertTracker nằm ở các thư mục bên dưới. Component chỉ thuộc một nghiệp vụ đặt trong `src/features/<feature>/components/`.

| Nhóm | Component | Vị trí | Hành vi chính |
|---|---|---|---|
| Khung app | `AppSidebar` | `components/app-shell/` | shadcn `sidebar`; thu gọn thành cột icon; ngăn kéo dưới 1024px; mục lọc theo vai trò (§4.5) |
| | `Topbar` | `components/app-shell/` | Breadcrumb trái; menu người dùng phải (email, `RoleBadge`, Đăng xuất) |
| | `PageHeader` | `components/app-shell/` | `page-title`, mô tả một dòng, vùng nút hành động bên phải |
| Dữ liệu | `DataTable` | `components/data/` | TanStack Table; compact; sắp xếp; chọn dòng; menu "⋯" cuối dòng; phân trang; trạng thái rỗng / đang tải (skeleton 5 dòng) / lỗi |
| | `FilterBar` | `components/data/` | Ô tìm kiếm + bộ lọc dạng chip + "Xóa lọc" (chỉ hiện khi có lọc) |
| | `EmptyState` | `components/data/` | Một câu giải thích + một nút hành động; không hình minh họa |
| Trạng thái | `ExpiryBadge` | `components/status/` | Nhận `expiry_status` + `days_to_expiry` + `expiry_date`; tooltip "Còn 23 ngày · hết hạn 19/10/2026" / "Đã hết hạn 5 ngày" |
| | `RecordStatus` | `components/status/` | Done `circle-check` · In Progress `loader-circle` · Not Started `circle-dashed`; chữ `foreground`, không màu trạng thái |
| | `ProgressInline` | `components/status/` | Thanh 4px màu `primary` trên `muted` + số % bên phải |
| | `RoleBadge` | `components/status/` | Admin / Manager / Member; badge trung tính (`secondary`) |
| | `MemberCode` | `components/status/` | `M001` bằng font mono, `muted-foreground` |
| Form | `FormField`, `Input`, `Textarea`, `Checkbox`, `Switch` | shadcn | Nhãn trên ô; lỗi dưới ô màu `destructive`; dùng chung Zod schema với server |
| | `Combobox` | shadcn `command` + `popover` | Chọn có tìm kiếm: member, khóa học, team |
| | `DatePicker` | shadcn `calendar` | Hiển thị `dd/MM/yyyy`; locale `vi`; tuần bắt đầu thứ Hai |
| Lớp phủ | `Dialog`, `Sheet`, `DropdownMenu`, `Tooltip` | shadcn | Xem §4.2 |
| | `ConfirmDialog` | `components/confirm-dialog.tsx` | Tiêu đề nêu tên đối tượng; mô tả hậu quả; nút xác nhận `destructive` ghi đúng hành động |
| Phản hồi | `Toast` | shadcn `sonner` | Góc dưới phải; thành công 4s, lỗi giữ tới khi đóng |
| | `Alert` | shadcn | Thông báo trong trang |
| Dashboard | `KpiTile` | `components/data/` (tuần 5) | Số `kpi`, nhãn `label`, biến động so với kỳ trước |

Icon: **lucide-react**, cỡ 16px trong bảng/nút, 20px trong sidebar. Nút chỉ có icon phải có `aria-label` và `Tooltip`.

---

## 4. Pattern

### 4.1 Trang danh sách

```
PageHeader   Thành viên · 42 người trong DC34                [+ Thêm thành viên]
FilterBar    [Tìm theo tên, email, mã…] [Team ▾] [Trạng thái ▾]      Xóa lọc
DataTable    Mã │ Họ tên │ Email │ Team │ Chứng chỉ │ Sắp hết hạn │ ⋯
             phân trang 25 dòng/trang
```

Cột đầu là định danh (mã hoặc tên), cột cuối là menu "⋯". Cột số canh phải.

### 4.2 Tạo, sửa, xem

| Trường hợp | Dùng |
|---|---|
| Form ≤ 6 trường (Team, Khóa học, CertType, Provider) | `Dialog` |
| Đối tượng có dữ liệu con (Thành viên + chứng chỉ của họ) | Trang chi tiết `/members/[id]` |
| Xem nhanh / sửa nhanh một bản ghi mà vẫn thấy bảng | `Sheet` bên phải |

Nút lưu nằm cuối form, bên phải; "Hủy" là nút phụ bên trái nó. Đang lưu thì nút hiện "Đang lưu…" và bị khóa.

### 4.3 Thao tác phá hủy

`ConfirmDialog`, ví dụ:

> **Xóa thành viên M004 · Nguyễn Văn An?**
> 5 bản ghi chứng chỉ của người này cũng sẽ bị xóa. Không thể hoàn tác.
> [Hủy] [Xóa thành viên]

Khi DB **chặn** xóa (vd. khóa học đang có bản ghi chứng chỉ dùng tới — `on delete restrict`), không mở `ConfirmDialog`: hiện `Alert` nói lý do và cách xử lý (*"Khóa học đang được 3 bản ghi sử dụng. Chuyển các bản ghi sang khóa khác trước khi xóa."*).

### 4.4 Phản hồi

- Thành công → toast nêu đúng việc vừa xảy ra: *"Đã thêm thành viên M004"*.
- Lỗi nhập liệu → dưới ô, nói sai gì và sửa thế nào: *"Email đã được dùng cho thành viên M002"*.
- Lỗi hệ thống → toast lỗi + cách xử lý: *"Không lưu được do mất kết nối. Kiểm tra mạng rồi thử lại."*
- Đang tải → skeleton đúng hình dạng nội dung; không dùng spinner toàn trang.

### 4.5 Menu theo vai trò

| Mục | Admin | Manager | Member |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| Chứng chỉ của tôi¹ | ✓ | ✓ | ✓ |
| Thành viên | ✓ | ✓ (team mình) | — |
| Chứng chỉ (theo người) | ✓ | ✓ (team mình) | — |
| Khóa học | ✓ | ✓ (chỉ xem) | ✓ (chỉ xem) |
| Tổ chức (DC / Program / Team) | ✓ | — | — |
| Import / Export | ✓ | — | — |
| Cài đặt | ✓ | — | — |

¹ Chỉ hiện khi tài khoản được liên kết với một thành viên (`profiles.member_id` khác null).

Ẩn chỉ là trải nghiệm; mọi quyền vẫn do RLS kiểm soát.

---

## 5. Câu chữ và định dạng

- Giao diện **tiếng Việt**; dữ liệu (tên khóa học, provider) giữ nguyên như nhập.
- Nút là động từ + đối tượng: "Thêm thành viên", "Lưu thay đổi", "Xóa khóa học". Không dùng "Submit", "OK", "Xác nhận" trống.
- Gọi tên theo điều người dùng nhận ra: "Chứng chỉ sắp hết hạn", không phải "expiry_status".
- Ngày: `dd/MM/yyyy` (lấy "hôm nay" theo `Asia/Ho_Chi_Minh`, `src/lib/dates.ts`).
- Số và tiền: `Intl.NumberFormat("vi-VN")` → `1.250.000 ₫`; phần trăm `75%`.
- Không emoji trong giao diện.

---

## 6. Truy cập

- Chữ ≥ 4.5:1 trên nền của nó; viền control, focus ring, icon mang nghĩa ≥ 3:1 (bảng ở §2.1, §2.2 — được kiểm tra bằng test).
- Focus ring `ring` 2px + offset 2px luôn nhìn thấy khi dùng bàn phím (`focus-visible`).
- Mọi thao tác làm được bằng bàn phím: menu dòng, hộp thoại (bẫy focus, `Esc` để đóng), combobox.
- Trạng thái luôn có chữ; icon trang trí có `aria-hidden`.
- Tôn trọng `prefers-reduced-motion`: tắt chuyển động trượt của sheet/sidebar, chỉ giữ đổi độ mờ.
- Vùng bấm tối thiểu 32×32px (24×24px cho icon trong ô bảng có khoảng trống xung quanh).

---

## 7. Responsive

| Độ rộng | Thay đổi |
|---|---|
| ≥ 1024px | Sidebar cố định (thu gọn được) |
| < 1024px | Sidebar thành ngăn kéo, mở bằng nút menu trên Topbar |
| < 640px | Form một cột; bảng cuộn ngang trong khung riêng, cột đầu dính; `PageHeader` xếp nút xuống dưới tiêu đề |

Trang không bao giờ cuộn ngang; chỉ bảng cuộn trong khung của nó.

---

## 8. Không làm

- Màu, cỡ chữ, bo góc viết cứng trong component (`bg-teal-700`, `#0E5C58`, `text-[13px]`).
- Dùng màu trạng thái cho thứ khác ngoài hạn chứng chỉ.
- Emoji làm icon; gradient trang trí; thẻ có sọc màu bên trái; bóng đổ trên thẻ/bảng.
- Bo góc lớn hơn 8px.
- Spinner toàn trang; hình minh họa trong empty state.
- Hiện nút rồi khóa vì thiếu quyền — ẩn đi.

---

## 9. Thay đổi design system

1. Sửa token trong `src/app/globals.css` và bảng tương ứng trong file này **cùng một commit**.
2. Chạy test tương phản (`pnpm test`); cặp nào dưới ngưỡng thì sửa màu, không hạ ngưỡng.
3. Kiểm tra bằng mắt ở trang `/design` (chỉ có ở môi trường dev).
4. Đồng bộ lên trang Design System trên claude.ai.
5. Quyết định lớn (đổi màu nhấn, thêm dark mode) → thêm mục vào `docs/decisions.md`.

## 10. Chưa làm

- **Dark mode** — token đã đặt tên theo vai trò; khi làm chỉ khai báo lại giá trị.
- **Bảng màu biểu đồ** — làm cùng Dashboard (tuần 5).
- **Logo** — chưa có; dùng chữ "CertTracker" (600, `foreground`).
