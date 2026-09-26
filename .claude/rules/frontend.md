---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/features/**/components/**"
---

# Frontend

- Mặc định Server Component; chỉ thêm `"use client"` khi cần state, effect hoặc event handler.
- Đọc dữ liệu trong Server Component qua `features/<x>/queries.ts`; ghi qua Server Action trong `features/<x>/actions.ts`.
- Form: React Hook Form + `zodResolver` với schema từ `features/<x>/schema.ts` (dùng chung với server).
- UI dùng shadcn/ui trong `src/components/ui`; bảng dùng TanStack Table; biểu đồ dùng Recharts.
- Text hiển thị bằng tiếng Việt; ngày hiển thị `dd/MM/yyyy`.
- Ẩn/hiện theo vai trò chỉ là UX — quyền thật do RLS quyết định.
- Realtime chỉ bật ở trang danh sách record và Dashboard; nhớ unsubscribe khi unmount.
