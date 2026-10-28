/** True when the browser can read a word aloud (Web Speech API). */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Say a word in US English, a little slower than normal. No-op without speech support. */
export function speak(word: string): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel(); // don't queue behind an earlier word
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
