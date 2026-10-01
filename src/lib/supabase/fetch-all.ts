type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * PostgREST silently truncates a response at `max_rows` (1000). Page with `.range(from, to)`
 * until a short page arrives. The query passed in MUST have a deterministic `.order(...)`,
 * otherwise rows can repeat or go missing between pages. `pageSize` stays below `max_rows` so a
 * full page always means "there may be more".
 *
 * Fails closed: when `maxRows` rows were read and one more row exists, it throws instead of returning a
 * silently truncated list (an import would plan against missing data, an export would drop rows). A table
 * that ends exactly at `maxRows` is fine; one extra row is requested to tell the two cases apart.
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
    if (!data || data.length === 0) return rows;
    rows.push(...data);
    if (data.length < to - from + 1) return rows;
  }
  const { data, error } = await fetchPage(maxRows, maxRows);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) throw new Error(`Query returned more than ${maxRows} rows`);
  return rows;
}
