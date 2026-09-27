---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/features/**/components/**"
---

# Frontend

- Mặc định Server Component; chỉ thêm `"use client"` khi cần state, effect hoặc event handler.
- Đọc dữ liệu trong Server Component qua `features/<x>/queries.ts`; ghi qua Server Action trong `features/<x>/actions.ts`.
- Form: React Hook Form + `zodResolver` với schema từ `features/<x>/schema.ts` (dùng chung với server); dựng bằng shadcn `field` (`Field`, `FieldLabel`, `FieldError`).
- UI dùng shadcn/ui trong `src/components/ui`; bảng dùng TanStack Table; biểu đồ dùng Recharts.
- Text hiển thị bằng tiếng Việt; ngày hiển thị `dd/MM/yyyy`.
- Ẩn/hiện theo vai trò chỉ là UX — quyền thật do RLS quyết định.
- Realtime chỉ bật ở trang danh sách record và Dashboard; nhớ unsubscribe khi unmount.
- Trước khi dựng UI: đọc `docs/design-system.md`. Chỉ dùng token (class `bg-primary`, `text-table`, `rounded-lg`…); không hex, không `bg-teal-*`, không `text-[13px]`.
- Ưu tiên component có sẵn: `src/components/app-shell` (PageHeader), `src/components/data` (DataTable, FilterBar, EmptyState), `src/components/status` (ExpiryBadge, RecordStatusLabel, ProgressInline, RoleBadge, MemberCode), `src/components/confirm-dialog.tsx`.
- shadcn `base-nova` dùng Base UI: ghép component bằng prop `render`, không phải `asChild`. `cn` luôn import từ `@/lib/utils`.
- `@tanstack/react-table` giữ ở v8 (v9 đổi API).
- Thêm/sửa token: sửa `src/app/globals.css` + bảng trong `docs/design-system.md` cùng commit; `pnpm test` kiểm tra tương phản. Thêm cỡ chữ `--text-*` mới thì thêm tên vào `createCn` trong `src/lib/utils.ts`.
- Xem trực quan ở `/design` (dev).
