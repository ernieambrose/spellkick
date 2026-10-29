import type { WordList } from '../../engine/types';

// Upcoming = test date today or later, soonest first. Earlier = past dates newest first, then undated.
export function groupLists(lists: WordList[], today: string): { upcoming: WordList[]; earlier: WordList[] } {
  const upcoming = lists
    .filter((l) => l.testDate !== null && l.testDate >= today)
    .sort((a, b) => a.testDate!.localeCompare(b.testDate!));
  const earlier = lists
    .filter((l) => l.testDate === null || l.testDate < today)
    .sort((a, b) => {
      if (a.testDate === b.testDate) return b.createdAt.localeCompare(a.createdAt);
      if (a.testDate === null) return 1;
      if (b.testDate === null) return -1;
      return b.testDate.localeCompare(a.testDate);
    });
  return { upcoming, earlier };
}
