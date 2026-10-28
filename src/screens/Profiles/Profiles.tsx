import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { PinPad } from '../../components/PinPad';
import { hashPin } from '../../engine/pin';
import type { Profile, Theme } from '../../engine/types';

const AVATAR_COLORS: Record<Theme, string> = {
  default: 'bg-primary',
  skate: 'bg-teal-500',
  fishing: 'bg-sky-500',
  art: 'bg-pink-500',
};

export function Profiles() {
  const repo = useRepo();
  const { select } = useActiveProfile();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pinFor, setPinFor] = useState<Profile | null>(null);

  useEffect(() => {
    let live = true;
    repo.listProfiles().then(
      (p) => live && setProfiles(p),
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [repo]);

  function enter(p: Profile) {
    select(p.id);
    navigate(`/kid/${p.id}`);
  }

  async function checkPin(p: Profile, pin: string): Promise<boolean> {
    const ok = (await hashPin(pin, p.id)) === p.pinHash;
    if (ok) enter(p);
    return ok;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
      <h1 className="text-center text-3xl font-bold text-primary">SpellKick</h1>
      <h2 className="mt-2 text-center text-xl text-slate-600">Who's practicing?</h2>

      <section className="flex-1 py-8">
        {loadFailed ? (
          <p className="text-center text-tricky-text">Couldn't load profiles. Check your connection.</p>
        ) : profiles === null ? null : profiles.length === 0 ? (
          <div className="mx-auto max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-700">No kids yet.</p>
            <p className="mt-2 text-slate-500">A grown-up can add one: tap Parent below.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (p.pinHash ? setPinFor(p) : enter(p))}
                  className="flex w-full flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-sm transition hover:shadow-md active:scale-[0.98]"
                >
                  <span
                    aria-hidden
                    className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl font-bold text-white ${AVATAR_COLORS[p.theme]}`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-lg font-semibold text-slate-800">{p.name}</span>
                  {p.pinHash && <span className="text-xs text-slate-400">PIN</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-center">
        <Link
          to="/parent"
          className="flex min-h-11 items-center rounded-full border border-slate-300 px-6 font-semibold text-slate-600 hover:bg-white"
        >
          Parent
        </Link>
      </div>

      {pinFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${pinFor.name}'s PIN`}
          className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <PinPad
            title={`${pinFor.name}'s PIN`}
            lockKey={pinFor.id}
            onSubmit={(pin) => checkPin(pinFor, pin)}
            onCancel={() => setPinFor(null)}
          />
        </div>
      )}
    </main>
  );
}
