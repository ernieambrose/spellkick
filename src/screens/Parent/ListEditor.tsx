import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRepo } from '../../app/repoContext';
import type { ListSource, Profile, WordList } from '../../engine/types';
import { parseWordList } from '../../engine/words';
import { Card, ConfirmDelete, fieldClass, labelClass, ParentPage, primaryButton } from './ui';

const SOURCES: { value: ListSource; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
];

export function ListEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const [params] = useSearchParams();
  const repo = useRepo();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [existing, setExisting] = useState<WordList | null>(null);
  const [missing, setMissing] = useState(false);
  const [profileId, setProfileId] = useState(params.get('profile') ?? '');
  const [name, setName] = useState('');
  const [testDate, setTestDate] = useState('');
  const [source, setSource] = useState<ListSource>('school');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const all = await repo.listProfiles();
      if (!live) return;
      setProfiles(all);
      if (isNew) {
        setProfileId((cur) => (all.some((p) => p.id === cur) ? cur : (all[0]?.id ?? '')));
        return;
      }
      // There's no lookup by list id, so search each kid's lists (a family has only a few).
      for (const p of all) {
        const found = (await repo.listLists(p.id)).find((l) => l.id === id);
        if (found && live) {
          setExisting(found);
          setProfileId(found.profileId);
          setName(found.name);
          setTestDate(found.testDate ?? '');
          setSource(found.source);
          setText(found.words.join('\n'));
          return;
        }
      }
      if (live) setMissing(true);
    })().catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [repo, id, isNew]);

  const parsed = useMemo(() => parseWordList(text), [text]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!profileId) return setError('Pick which kid this list is for.');
    if (!trimmed) return setError('Give the list a name.');
    if (parsed.words.length === 0) return setError('Add at least one word.');
    setSaving(true);
    try {
      await repo.saveList({
        id: existing?.id ?? crypto.randomUUID(),
        profileId,
        name: trimmed,
        testDate: testDate || null,
        source,
        author: existing?.author ?? null,
        words: parsed.words,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      navigate('/parent');
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await repo.deleteList(existing.id);
      navigate('/parent');
    } catch {
      setError("Couldn't delete. Check your connection and try again.");
    }
  }

  if (missing) {
    return (
      <ParentPage title="Word list">
        <p className="text-tricky-text">That list wasn't found.</p>
      </ParentPage>
    );
  }
  if (!profiles || (!isNew && !existing)) return null;

  const kidName = profiles.find((p) => p.id === profileId)?.name;

  return (
    <ParentPage title={isNew ? 'New word list' : 'Edit word list'}>
      <Card>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5">
          {isNew ? (
            <div>
              <label htmlFor="list-kid" className={labelClass}>
                Kid
              </label>
              <select
                id="list-kid"
                className={fieldClass}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            kidName && <p className="text-slate-600">For {kidName}</p>
          )}

          <div>
            <label htmlFor="list-name" className={labelClass}>
              List name
            </label>
            <input
              id="list-name"
              className={fieldClass}
              placeholder="Week 3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="list-date" className={labelClass}>
                Test date (optional)
              </label>
              <input
                id="list-date"
                type="date"
                className={fieldClass}
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="list-source" className={labelClass}>
                Source
              </label>
              <select
                id="list-source"
                className={fieldClass}
                value={source}
                onChange={(e) => setSource(e.target.value as ListSource)}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="list-words" className={labelClass}>
              Words
            </label>
            <textarea
              id="list-words"
              rows={8}
              className={`${fieldClass} py-2`}
              placeholder="Type or paste the list: one per line, or separated by commas"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <WordPreview words={parsed.words} dropped={parsed.dropped} truncated={parsed.truncated} />

          <p role="alert" className="min-h-6 font-semibold text-tricky-text">
            {error}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={primaryButton}>
              Save list
            </button>
            {existing && <ConfirmDelete label="Delete list" onConfirm={remove} />}
          </div>
        </form>
      </Card>
    </ParentPage>
  );
}

function WordPreview({ words, dropped, truncated }: { words: string[]; dropped: string[]; truncated: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-slate-700">
        {words.length} {words.length === 1 ? 'word' : 'words'}
      </p>
      {words.length > 0 && (
        <ul aria-label="Preview" className="flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w} className="rounded-full bg-slate-100 px-3 py-1 text-slate-800">
              {w}
            </li>
          ))}
        </ul>
      )}
      {truncated && (
        <p className="rounded-2xl bg-tricky-bg p-3 text-tricky-text">
          That's more than 100 words, so only the first 100 were kept.
        </p>
      )}
      {dropped.length > 0 && <p className="text-slate-500">Skipped (not words): {dropped.join(', ')}</p>}
    </div>
  );
}
