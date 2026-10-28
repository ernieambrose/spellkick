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
      key={round}
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
  const home = `/kid/${kidId}`;

  useEffect(() => {
    wordStart.current = Date.now(); // each word is timed from when it appears
  }, [s.index, s.loading]);

  function onResult(r: GameResult) {
    if (!s.current) return;
    s.record({ word: s.current.word, kind: r.kind, ms: Date.now() - wordStart.current, spotFix: r.spotFix });
    if (r.kind !== 'practice') s.next();
  }

  const Game = GAMES[game];
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6">
      {s.loading ? (
        <p className="py-20 text-center text-lg text-slate-500">Getting your words ready…</p>
      ) : s.done ? (
        <SessionDone summary={s.summary} awardsHref={`${home}/awards`} homeHref={home} onPlayAgain={onPlayAgain} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Link
              to={home}
              aria-label="Back to home"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-300 font-semibold text-slate-600 hover:bg-white"
            >
              ←
            </Link>
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
                onSkip={s.skip}
                timerOn={s.timerOn}
              />
            </section>
          )}
        </>
      )}
    </main>
  );
}
