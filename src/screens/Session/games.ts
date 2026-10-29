import type { ComponentType } from 'react';
import type { SessionWord } from '../../engine/selection';
import type { AttemptKind, GameId } from '../../engine/types';
import { Scramble } from '../Games/Scramble';
import { SpotMisspelling } from '../Games/SpotMisspelling';

export interface GameResult {
  kind: AttemptKind;
  spotFix?: boolean; // a correctly typed fix in Spot the Misspelling (worth 2 stars)
}

/**
 * What every game receives. The shell times the word and records results.
 * Any result except 'practice' ends the word; after a 'practice' result the game
 * ends the word with another onResult or with onSkip. Once a word has ended, further
 * calls for it are ignored.
 * The word unmounts as soon as it ends, so a game shows its own feedback (shake,
 * correct spelling) before calling onResult.
 * A game must never call makeMisspelling without a loaded dictionary (the session
 * only starts Spot the Misspelling once loadDictionary() has succeeded).
 */
export interface GameProps {
  word: SessionWord;
  allWords: string[]; // every word in the kid's lists, display casing
  fallbackWords: string[]; // gradeWords at the kid's generatedLevel
  onResult(r: GameResult): void;
  onSkip(): void;
  timerOn: boolean;
}

export const GAMES: Record<GameId, ComponentType<GameProps>> = {
  scramble: Scramble,
  misspell: SpotMisspelling,
};
