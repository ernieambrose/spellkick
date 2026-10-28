import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ProgressBar } from '../../components/ProgressBar';
import { Timer } from '../../components/Timer';
import type { GameId } from '../../engine/types';
import { GAMES, type GameResult } from './games';
import { SessionDone } from './SessionDone';
import { useSession } from './useSession';

const isGame = (g: string | undefined): g is GameId => g === 'scramble' || g === 'misspell';

// /kid/:id/play/:game[?mode=extra]. "Play again" remounts the session with a fresh set of words.
export function SessionShell() {
  const { id, game } = useParams();
  const [params] = useSearchParams();
  const [round, setRound] = useState(0);
  if (!isGame(game)) return <Navigate to={`/kid/${id}`} replace />;
  return (
    <SessionRun
      key={`${game}-${params.get('mode')}-${round}`}
      kidId={id!}
      game={game}
      mode={params.get('mode') === 'extra' ? 'extra' : 'normal'}
      onPlayAgain={() => setRound((r) => r + 1)}
    />
  );
}

interface RunProps {
  kidId: string;
  game: GameId;
  mode: 'normal' | 'extra';
  onPlayAgain(): void;
}

function SessionRun({ kidId, game, mode, onPlayAgain }: RunProps) {
  const s = useSession(game, { mode });
  const wordStart = useRef(0);
  const ended = useRef(-1); // the last index that has ended; guards double taps and onResult + onSkip
  const home = `/kid/${kidId}`;

  useEffect(() => {
    wordStart.current = Date.now(); // each word is timed from when it appears
  }, [s.index, s.loading]);

  function endWord(index: number): boolean {
    if (ended.current >= index) return false;
    ended.current = index;
    return true;
  }

  function onResult(r: GameResult) {
    const { current, index } = s;
    if (!current || ended.current >= index) return;
    if (r.kind !== 'practice' && !endWord(index)) return;
    s.record({ word: current.word, kind: r.kind, ms: Date.now() - wordStart.current, spotFix: r.spotFix });
    if (r.kind !== 'practice') s.next();
  }

  function onSkip() {
    if (endWord(s.index)) s.skip();
  }

  const homeLink = (
    <Link
      to={home}
      aria-label="Back to home"
      className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 font-semibold text-slate-600 hover:bg-white"
    >
      ←
    </Link>
  );
  const pillLink =
    'flex min-h-12 items-center justify-center rounded-full px-6 text-lg font-semibold transition active:scale-95';

  const Game = GAMES[game];
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6">
      {s.error === 'dictionary' ? (
        <>
          {homeLink}
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <p className="text-xl font-semibold text-slate-700">
              Spot the Misspelling needs its word list. Try Scramble instead.
            </p>
            <Link to={`${home}/play/scramble`} className={`${pillLink} bg-primary text-white`}>
              Play Scramble
            </Link>
          </div>
        </>
      ) : s.error === 'load' ? (
        <>
          {homeLink}
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <p className="text-xl font-semibold text-slate-700">Couldn't get your words. Check your connection.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={s.retry} className={`${pillLink} bg-primary text-white`}>
                Try again
              </button>
              <Link to={home} className={`${pillLink} border border-slate-300 text-slate-600`}>
                Go home
              </Link>
            </div>
          </div>
        </>
      ) : s.loading ? (
        <>
          {homeLink}
          <p className="py-20 text-center text-lg text-slate-500">Getting your words ready…</p>
        </>
      ) : s.done ? (
        <SessionDone summary={s.summary} awardsHref={`${home}/awards`} homeHref={home} onPlayAgain={onPlayAgain} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            {homeLink}
            <div className="flex-1">
              <ProgressBar value={s.index} max={s.words.length} label="Session progress" />
            </div>
            <span className="text-sm font-semibold text-slate-500">
              {s.index + 1} of {s.words.length}
            </span>
            {s.timerOn && <Timer key={s.index} running />}
          </div>
          {s.current && (
            <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <Game
                key={s.index}
                word={s.current}
                allWords={s.allWords}
                fallbackWords={s.fallbackWords}
                onResult={onResult}
                onSkip={onSkip}
                timerOn={s.timerOn}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
