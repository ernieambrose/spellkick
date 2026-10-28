import { fetchAllPages, PAGE_SIZE } from '../../src/data/paging';

describe('fetchAllPages', () => {
  const fakeTable = (total: number) => {
    const rows = Array.from({ length: total }, (_, i) => i);
    const calls: [number, number][] = [];
    const page = async (from: number, to: number) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    };
    return { rows, calls, page };
  };

  it('pages 1000 at a time until a short page, keeping order', async () => {
    const t = fakeTable(2345);
    expect(PAGE_SIZE).toBe(1000);
    expect(await fetchAllPages(t.page)).toEqual(t.rows);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('asks once more after an exactly full last page', async () => {
    const t = fakeTable(1000);
    expect(await fetchAllPages(t.page)).toHaveLength(1000);
    expect(t.calls).toHaveLength(2);
  });

  it('returns [] for an empty table', async () => {
    expect(await fetchAllPages(fakeTable(0).page)).toEqual([]);
  });

  it('throws the Supabase error message', async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });
});
