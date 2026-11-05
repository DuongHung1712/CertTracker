/** `1 day`, `3 days`; pass `plural` for an irregular form (`1 box`, `2 boxes`). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
