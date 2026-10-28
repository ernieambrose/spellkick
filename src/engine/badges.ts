import type { Stats } from './scoring';

export type BadgeDef = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  progress(stats: Stats): { value: number; goal: number };
};

const badge = (
  id: string,
  name: string,
  emoji: string,
  description: string,
  stat: keyof Stats,
  goal: number,
): BadgeDef => ({
  id,
  name,
  emoji,
  description,
  progress: (stats) => ({ value: Math.min(stats[stat], goal), goal }),
});

export const BADGES: readonly BadgeDef[] = [
  badge('first-kick', 'First Kick', '🛹', 'Finish your first practice.', 'sessions', 1),
  badge('streak-3', 'Three-Peat', '🔥', 'Practice 3 days in a row.', 'streakBest', 3),
  badge('streak-7', 'Week Warrior', '🗓️', 'Practice 7 days in a row.', 'streakBest', 7),
  badge('streak-master', 'Kickflip Streak', '🛹', 'Practice 10 days in a row.', 'streakBest', 10),
  badge('streak-30', 'Month of Magic', '🌙', 'Practice 30 days in a row.', 'streakBest', 30),
  badge('mastered-10', 'Word Collector', '📚', 'Master 10 words.', 'mastered', 10),
  badge('mastered-25', 'Big Catch', '🎣', 'Master 25 words.', 'mastered', 25),
  badge('mastered-50', 'Spelling Artist', '🎨', 'Master 50 words.', 'mastered', 50),
  badge('mastered-100', 'Word Wizard', '🧙', 'Master 100 words.', 'mastered', 100),
  badge('comeback', 'Comeback Kid', '💪', 'Master a word that used to be tricky.', 'comebacks', 1),
  badge('comeback-10', 'Trick Slayer', '🏆', 'Master 10 words that used to be tricky.', 'comebacks', 10),
  badge('stars-50', 'Star Catcher', '⭐', 'Earn 50 stars.', 'stars', 50),
  badge('stars-250', 'Starry Night', '🌟', 'Earn 250 stars.', 'stars', 250),
  badge('tricky-tamer', 'Tricky Tamer', '🦁', 'Finish 5 practices full of tricky words.', 'trickySessions', 5),
];

/** Ids of badges whose goal is met and that are not already earned, in catalog order. */
export function evaluateBadges(stats: Stats, earned: Set<string>): string[] {
  return BADGES.filter((b) => {
    if (earned.has(b.id)) return false;
    const { value, goal } = b.progress(stats);
    return value >= goal;
  }).map((b) => b.id);
}
