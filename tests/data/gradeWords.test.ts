import gradeWords from '../../src/data/gradeWords.json';
import { isInappropriateWord } from '../../src/engine/safety';

const grades = gradeWords as Record<string, string[]>;

describe('gradeWords', () => {
  it('has exactly grades 1 through 8', () =>
    expect(Object.keys(grades).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']));
  it('every grade has ≥150 words and none are isInappropriateWord', () => {
    for (const [grade, words] of Object.entries(grades)) {
      expect(words.length, `grade ${grade}`).toBeGreaterThanOrEqual(150);
      const bad = words.filter((w) => isInappropriateWord(w));
      expect(bad, `grade ${grade}`).toEqual([]);
    }
  });
  it('words are lowercase letters only and distinct within a grade', () => {
    for (const [grade, words] of Object.entries(grades)) {
      const malformed = words.filter((w) => !/^[a-z]+$/.test(w));
      expect(malformed, `grade ${grade}`).toEqual([]);
      const dupes = words.filter((w, i) => words.indexOf(w) !== i);
      expect(dupes, `grade ${grade}`).toEqual([]);
    }
  });
});
