type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * PostgREST silently truncates a response at `max_rows` (1000). Page with `.range(from, to)`
 * until a short page arrives. The query passed in MUST have a deterministic `.order(...)`,
 * otherwise rows can repeat or go missing between pages. `pageSize` stays below `max_rows` so a
 * full page always means "there may be more".
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 500,
  maxRows = 20000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < to - from + 1) break;
  }
  return rows;
}
