import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/authContext';
import { useActiveProfile } from '../../app/profileContext';
import { useRepo } from '../../app/repoContext';
import { isOfflineRepo } from '../../data/offlineRepo';
import { localDate } from '../../engine/streak';
import type { Profile, WordList } from '../../engine/types';
import { groupLists } from './listGroups';
import { useParentArea } from './parentArea';
import { Card, primaryButton, secondaryButton } from './ui';

interface KidLists {
  profile: Profile;
  lists: WordList[];
}

export function ParentHome() {
  const repo = useRepo();
  const { signOut } = useAuth();
  const { clear } = useActiveProfile();
  const navigate = useNavigate();
  const { changePin } = useParentArea();
  const [kids, setKids] = useState<KidLists[] | null>(null);
  const [today, setToday] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [unsynced, setUnsynced] = useState(false); // asking "Sign out anyway?"
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const profiles = await repo.listProfiles();
      profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return Promise.all(profiles.map(async (profile) => ({ profile, lists: await repo.listLists(profile.id) })));
    })().then(
      (k) => {
        if (!live) return;
        setToday(localDate(new Date()));
        setKids(k);
      },
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [repo]);

  async function handleSignOut(force = false) {
    setSigningOut(true);
    if (!force && isOfflineRepo(repo)) {
      await repo.flush(); // send what we can while the session still exists
      if ((await repo.pending()) > 0) {
        setSigningOut(false);
        setUnsynced(true);
        return;
      }
    }
    clear();
    await signOut();
    navigate('/signin');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="w-full text-3xl font-bold text-primary sm:w-auto sm:flex-1">Parent</h1>
        <Link to="/profiles" className={secondaryButton}>
          Back to kids
        </Link>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          className={secondaryButton}
        >
          Sign out
        </button>
      </header>

      {unsynced && (
        <Card>
          <p role="alert" className="font-semibold text-tricky-text">
            Some practice hasn't synced yet. Sign out anyway?
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleSignOut(true)} className={primaryButton}>
              Sign out anyway
            </button>
            <button type="button" onClick={() => setUnsynced(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {loadFailed && <p className="text-tricky-text">Couldn't load your kids. Check your connection.</p>}

      {kids?.length === 0 && (
        <Card>
          <p className="text-lg font-semibold text-slate-700">No kids yet.</p>
          <p className="mt-1 text-slate-500">Add one to start entering spelling lists.</p>
        </Card>
      )}

      {kids?.map(({ profile, lists }) => {
        const { upcoming, earlier } = groupLists(lists, today);
        return (
          <Card key={profile.id}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-xl font-bold text-slate-800">
                {profile.name} <span className="text-base font-normal text-slate-500">Grade {profile.grade}</span>
              </h2>
              <Link to={`/parent/progress/${profile.id}`} className={secondaryButton}>
                Progress
              </Link>
              <Link to={`/parent/profile/${profile.id}`} className={secondaryButton}>
                Edit
              </Link>
            </div>

            <ListGroup title="Upcoming" lists={upcoming} />
            <ListGroup title="Earlier" lists={earlier} />
            {lists.length === 0 && <p className="mt-4 text-slate-500">No word lists yet.</p>}

            <Link
              to={`/parent/list/new?profile=${profile.id}`}
              className={`${primaryButton} mt-4 inline-flex items-center`}
            >
              Add word list
            </Link>
          </Card>
        );
      })}

      {kids && (
        <div className="flex flex-wrap gap-3">
          <Link to="/parent/profile/new" className={secondaryButton}>
            + Add kid
          </Link>
          <button type="button" onClick={changePin} className={secondaryButton}>
            Change parent PIN
          </button>
        </div>
      )}
    </main>
  );
}

function ListGroup({ title, lists }: { title: string; lists: WordList[] }) {
  if (lists.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul aria-label={title} className="flex flex-col gap-2">
        {lists.map((l) => (
          <li key={l.id}>
            <Link
              to={`/parent/list/${l.id}`}
              className="flex min-h-11 flex-wrap items-center gap-x-3 rounded-2xl bg-slate-50 px-4 py-2 hover:bg-review-bg"
            >
              <span className="flex-1 font-semibold text-slate-800">{l.name}</span>
              <span className="text-sm text-slate-500">
                {l.words.length} words{l.testDate ? ` · test ${l.testDate}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
