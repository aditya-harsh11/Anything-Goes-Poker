import { useEffect } from 'react';
import { VARIANT_LIST, type Variant } from '@poker/shared';

interface Props {
  current: Variant;
  onPick: (v: Variant) => void;
  onClose: () => void;
  /**
   * When false, the picker can't be dismissed (no Close button, no Escape, no
   * backdrop-click). Used during the awaitingDealerPick phase where the deal is
   * blocked on the dealer choosing.
   */
  dismissable?: boolean;
  /** Optional subtitle, e.g. "It's your deal — pick the game". */
  subtitle?: string;
}

/** Modal listing every available game type with its rules — the dealer picks from here. */
export default function VariantPicker({ current, onPick, onClose, dismissable = true, subtitle }: Props) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-brass-bright sm:text-2xl">Choose the game</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-dim">{subtitle}</p>}
          </div>
          {dismissable && (
            <button onClick={onClose} className="btn btn-ghost px-3 py-1 text-xs">
              Close
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
          {VARIANT_LIST.map((v) => {
            const active = v.id === current;
            return (
              <li key={v.id}>
                <button
                  onClick={() => {
                    onPick(v.id);
                    onClose();
                  }}
                  className={`w-full rounded-xl p-3 text-left ring-1 transition ${
                    active ? 'bg-brass/20 ring-brass/50' : 'bg-black/30 ring-brass/10 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{v.name}</span>
                    {active && (
                      <span className="shrink-0 rounded-full bg-brass px-2 py-0.5 text-[10px] font-bold text-black">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-ink-dim">{v.description}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
