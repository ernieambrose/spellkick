export type ScrambleMode = 'tiles' | 'type';

const key = (profileId: string) => `spellkick.scrambleMode.${profileId}`;

// A per-device convenience: if storage is unavailable the kid just starts on tiles each time.
export function readScrambleMode(profileId: string | null): ScrambleMode {
  if (!profileId) return 'tiles';
  try {
    return localStorage.getItem(key(profileId)) === 'type' ? 'type' : 'tiles';
  } catch {
    return 'tiles';
  }
}

export function writeScrambleMode(profileId: string | null, mode: ScrambleMode): void {
  if (!profileId) return;
  try {
    localStorage.setItem(key(profileId), mode);
  } catch {
    // ignore: the choice still holds for this word
  }
}
