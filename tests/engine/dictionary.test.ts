describe('loadDictionary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses the fetched list into a Set and fetches only once', async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => new Response('apple\nbanana\r\n\ncherry\n'));
    vi.stubGlobal('fetch', fetchMock);
    const { loadDictionary } = await import('../../src/engine/dictionary');
    const dict = await loadDictionary();
    expect(dict).toEqual(new Set(['apple', 'banana', 'cherry']));
    expect(await loadDictionary()).toBe(dict);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}dictionary.txt`);
  });
});
