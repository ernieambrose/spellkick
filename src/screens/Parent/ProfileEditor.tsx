import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { hashPin } from '../../engine/pin';
import type { Profile, Theme } from '../../engine/types';
import { Card, ConfirmDelete, fieldClass, labelClass, ParentPage, primaryButton, secondaryButton } from './ui';

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
const THEMES: { value: Theme; label: string }[] = [
  { value: 'default', label: 'Classic' },
  { value: 'skate', label: 'Skate' },
  { value: 'fishing', label: 'Fishing' },
  { value: 'art', label: 'Art' },
];
const timerDefault = (grade: number) => grade >= 4;

export function ProfileEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const repo = useRepo();
  const { activeId, clear } = useActiveProfile();
  const navigate = useNavigate();

  const [existing, setExisting] = useState<Profile | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(2);
  const [timerOn, setTimerOn] = useState(timerDefault(2));
  const [timerTouched, setTimerTouched] = useState(false);
  const [theme, setTheme] = useState<Theme>('default');
  const [pin, setPin] = useState('');
  const [keepPin, setKeepPin] = useState(false); // editing: the stored PIN stays unless removed
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let live = true;
    repo.listProfiles().then(
      (all) => {
        if (!live) return;
        const p = all.find((x) => x.id === id);
        if (!p) return setMissing(true);
        setExisting(p);
        setName(p.name);
        setGrade(p.grade);
        setTimerOn(p.timerOn);
        setTimerTouched(true);
        setTheme(p.theme);
        setKeepPin(p.pinHash !== null);
      },
      () => live && setMissing(true),
    );
    return () => {
      live = false;
    };
  }, [repo, id, isNew]);

  function changeGrade(g: number) {
    setGrade(g);
    if (!timerTouched) setTimerOn(timerDefault(g));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Add a name.');
    if (pin && !/^\d{4}$/.test(pin)) return setError('A PIN is exactly 4 digits.');
    setSaving(true);
    try {
      const profileId = existing?.id ?? crypto.randomUUID();
      const pinHash = pin ? await hashPin(pin, profileId) : keepPin ? (existing?.pinHash ?? null) : null;
      await repo.saveProfile({
        id: profileId,
        name: trimmed,
        grade,
        generatedLevel: existing?.generatedLevel ?? grade,
        pinHash,
        timerOn,
        theme,
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
      await repo.deleteProfile(existing.id);
      if (activeId === existing.id) clear();
      navigate('/parent');
    } catch {
      setError("Couldn't delete. Check your connection and try again.");
    }
  }

  if (missing) {
    return (
      <ParentPage title="Kid">
        <p className="text-tricky-text">That kid wasn't found.</p>
      </ParentPage>
    );
  }
  if (!isNew && !existing) return null;

  return (
    <ParentPage title={isNew ? 'Add a kid' : `Edit ${existing!.name}`}>
      <Card>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5">
          <div>
            <label htmlFor="kid-name" className={labelClass}>
              Name
            </label>
            <input id="kid-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="kid-grade" className={labelClass}>
                Grade
              </label>
              <select
                id="kid-grade"
                className={fieldClass}
                value={grade}
                onChange={(e) => changeGrade(Number(e.target.value))}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kid-theme" className={labelClass}>
                Theme
              </label>
              <select
                id="kid-theme"
                className={fieldClass}
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                {THEMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex min-h-11 items-center gap-3 font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-6 w-6 accent-primary"
              checked={timerOn}
              onChange={(e) => {
                setTimerOn(e.target.checked);
                setTimerTouched(true);
              }}
            />
            Timer on (bonus points only)
          </label>

          <div>
            <label htmlFor="kid-pin" className={labelClass}>
              Kid PIN (optional)
            </label>
            {keepPin && !pin && (
              <div className="mb-2 flex flex-wrap items-center gap-3 text-slate-600">
                <span>A PIN is set. Type a new one to change it.</span>
                <button type="button" onClick={() => setKeepPin(false)} className={secondaryButton}>
                  Remove PIN
                </button>
              </div>
            )}
            <input
              id="kid-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className={`${fieldClass} max-w-40 tracking-[0.5em]`}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <p role="alert" className="min-h-6 font-semibold text-tricky-text">
            {error}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={primaryButton}>
              Save
            </button>
            {existing && <ConfirmDelete label={`Delete ${existing.name}`} onConfirm={remove} />}
          </div>
        </form>
      </Card>
    </ParentPage>
  );
}
