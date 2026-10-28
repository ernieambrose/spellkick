export type TilesTone = 'normal' | 'correct' | 'shake';

interface Props {
  tiles: string[]; // one letter per tile
  slots: (number | null)[]; // the tile index placed in each answer slot
  locked: number; // the first `locked` slots are hint letters and can't be removed
  tone: TilesTone;
  disabled: boolean;
  onTapTile(tile: number): void;
  onTapSlot(slot: number): void;
}

const tileSize = 'flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold sm:h-14 sm:w-14';

// Answer slots on top, the letter tray below. Tiles are tracked by index so repeated letters work.
export function LetterTiles({ tiles, slots, locked, tone, disabled, onTapTile, onTapSlot }: Props) {
  const placed = new Set(slots.filter((s): s is number => s !== null));
  const slotColor = (i: number, filled: boolean) =>
    tone === 'correct'
      ? 'bg-mastered-bg text-mastered-text'
      : i < locked
        ? 'bg-primary text-white'
        : filled
          ? 'border-2 border-review bg-white text-review-text'
          : 'border-2 border-dashed border-slate-300 bg-slate-50';

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        role="group"
        aria-label="Your answer"
        className={`flex flex-wrap justify-center gap-2 ${tone === 'shake' ? 'motion-safe:animate-shake' : ''}`}
      >
        {slots.map((tile, i) => {
          const letter = tile === null ? '' : tiles[tile];
          return (
            <button
              key={i}
              type="button"
              aria-label={letter ? `Slot ${i + 1}, ${letter}` : `Slot ${i + 1}, empty`}
              disabled={disabled}
              onClick={() => onTapSlot(i)}
              className={`${tileSize} transition ${slotColor(i, tile !== null)}`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Letter tiles" className="flex flex-wrap justify-center gap-2">
        {tiles.map((letter, i) =>
          placed.has(i) ? (
            <span key={i} aria-hidden="true" className={`${tileSize} bg-slate-100`} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onTapTile(i)}
              className={`${tileSize} bg-review-bg text-review-text shadow-sm transition active:scale-95`}
            >
              {letter}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
