---
paths:
  - "src/lib/ai/**"
  - "src/app/api/ai/**"
---

# AI features

- Chỉ gọi LLM từ server; API key chỉ đọc từ env server.
- Dữ liệu đưa vào prompt lấy qua Supabase client mang JWT người dùng (tuân RLS), không dùng service role.
- Qua `pii.ts` trước khi gửi: thay tên/email bằng `members.code`, map ngược khi hiển thị.
- Mọi lời gọi đi qua `governor.ts` (rate limit theo user) và ghi `ai_runs`.
- Output ràng buộc bằng Zod schema (`features/<name>/schema.ts`).
- Số liệu tính bằng SQL; LLM chỉ diễn giải/gợi ý.
- Kết quả làm thay đổi dữ liệu phải qua bước người dùng xác nhận.
- Ask Your Data: LLM sinh *query spec* trong whitelist, **không bao giờ** sinh SQL để chạy trực tiếp.
- Lỗi/timeout AI không được làm hỏng luồng chính của app.
