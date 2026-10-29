let cached: Promise<Set<string>> | null = null;

/** Fetch the bundled word list once; later calls share the same promise. */
export function loadDictionary(): Promise<Set<string>> {
  cached ??= fetch(`${import.meta.env.BASE_URL}dictionary.txt`)
    .then((res) => {
      if (!res.ok) throw new Error(`dictionary fetch failed: ${res.status}`);
      return res.text();
    })
    .then((text) => new Set(text.split('\n').map((l) => l.trim()).filter(Boolean)))
    .catch((err: unknown) => {
      cached = null;
      throw err;
    });
  return cached;
}
