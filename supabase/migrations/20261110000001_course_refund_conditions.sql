-- Free-text conditions under which a refundable course is reimbursed (Review comment 2026-11-10).
alter table public.courses
  add column refund_conditions text,
  add constraint courses_refund_conditions_len check (char_length(refund_conditions) <= 1000);
