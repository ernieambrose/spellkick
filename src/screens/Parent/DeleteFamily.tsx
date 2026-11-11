import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/authContext';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { Card, fieldClass, labelClass, ParentPage } from './ui';

const CONFIRM_WORD = 'delete';

/** Remove this app's per-device settings (picked kid, Scramble tap/type, and so on). */
function clearDeviceSettings() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('spellkick.')) localStorage.removeItem(k);
  } catch {
    // storage blocked: nothing to clear
  }
}

export function DeleteFamily() {
  const repo = useRepo();
  const { signOut } = useAuth();
  const { clear } = useActiveProfile();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  async function onDelete(e: FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError("You're offline. Connect to the internet to delete your family's data.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.deleteFamily();
    } catch {
      setBusy(false);
      setError("Couldn't delete. Nothing was removed. Check your connection and try again.");
      return;
    }
    clear();
    clearDeviceSettings();
    await signOut({ local: true }); // the server already dropped this account's sessions
    navigate('/signin', { replace: true, state: { deleted: true } });
  }

  return (
    <ParentPage title="Delete my family's data">
      <Card>
        <p className="text-lg font-semibold text-slate-800">This permanently deletes:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
          <li>Your SpellKick account and the email you sign in with</li>
          <li>Every kid profile, with their word lists</li>
          <li>All practice history, streaks, and badges</li>
          <li>Your parent PIN</li>
        </ul>
        <p className="mt-3 text-slate-700">
          It can't be undone. To use SpellKick again later, you'd need a new invite.
        </p>
      </Card>

      <Card>
        <form onSubmit={(e) => void onDelete(e)} className="flex flex-col gap-4">
          <div>
            <label htmlFor="confirm-delete" className={labelClass}>
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </label>
            <input
              id="confirm-delete"
              className={fieldClass}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>
          <button
            type="submit"
            disabled={!confirmed || busy}
            className="min-h-11 rounded-full bg-tricky-text px-6 font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
          {error && (
            <p role="alert" className="font-semibold text-tricky-text">
              {error}
            </p>
          )}
        </form>
      </Card>
    </ParentPage>
  );
}
