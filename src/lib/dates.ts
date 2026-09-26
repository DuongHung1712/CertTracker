export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in Vietnam as `YYYY-MM-DD`. */
export function toVnDateString(date: Date): string {
  return vnDateFormatter.format(date);
}
