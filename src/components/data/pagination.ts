export function pageRangeLabel(pageIndex: number, pageSize: number, total: number): string {
  if (total === 0) return "0 results";
  const start = pageIndex * pageSize + 1;
  const end = Math.min(total, (pageIndex + 1) * pageSize);
  return `${start}–${end} of ${total}`;
}
