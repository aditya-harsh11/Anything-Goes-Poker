import { useEffect, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** A fully themed dropdown (native <select> popups can't be styled — dark bg, no blue). */
export default function Dropdown({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-brass/50 bg-emerald-900/50 px-3 py-2 text-left text-sm font-semibold text-brass-bright transition hover:border-brass/70 disabled:opacity-50"
      >
        <span className="truncate">{current?.label ?? 'Select'}</span>
        <span className={`ml-2 text-brass transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && !disabled && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-brass/30 bg-[#0c100d] p-1.5 shadow-2xl ring-1 ring-black/40">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selected
                      ? 'bg-emerald-800/60 font-semibold text-brass-bright'
                      : 'text-ink hover:bg-white/8 hover:text-brass-bright'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
