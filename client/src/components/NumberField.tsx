import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * A numeric input that tracks its own typed text instead of always mirroring a coerced
 * number. Plain `<input type="number" value={n} onChange={... Number(e.target.value)}>`
 * turns a cleared field into 0 immediately, so the field never actually goes empty —
 * the next digit you type lands after that leftover "0" (clearing "7" then typing "3"
 * produces "03"). Here the field can sit empty while focused; it only re-syncs to the
 * external value on blur or when that value changes elsewhere.
 */
export default function NumberField({ value, onChange, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === '' || raw === '-') return; // let it sit empty mid-edit
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(String(value));
        onBlur?.(e);
      }}
    />
  );
}
