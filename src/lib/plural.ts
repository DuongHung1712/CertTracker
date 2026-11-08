import { formatNumber } from "@/lib/format";

/** `1 day`, `3 days`; pass `plural` for an irregular form (`1 box`, `2 boxes`). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Time left to expiry for a list or card: `Expires today`, `1 day left`, `45 days left`, `Expired 5 days ago`. */
export function daysLeftLabel(days: number): string {
  if (days === 0) return "Expires today";
  if (days < 0) return `Expired ${pluralize(-days, "day")} ago`;
  return `${pluralize(days, "day")} left`;
}
