import { type Card, SUIT_SYMBOL } from '@poker/shared';

interface Props {
  card?: Card;
  hidden?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZES = {
  xs: { box: 'w-8 h-11', rank: 'text-xs', suit: 'text-sm' },
  sm: { box: 'w-11 h-15', rank: 'text-sm', suit: 'text-lg' },
  md: { box: 'w-13 h-18', rank: 'text-base', suit: 'text-2xl' },
  lg: { box: 'w-16 h-22', rank: 'text-lg', suit: 'text-3xl' },
};

export default function PlayingCard({ card, hidden, size = 'md' }: Props) {
  const s = SIZES[size];

  if (hidden || !card) {
    return (
      <div
        className={`${s.box} rounded-[6px] border border-brass/40 shadow-md`}
        style={{
          background:
            'repeating-linear-gradient(135deg, #0f5135 0 6px, #0c3f29 6px 12px)',
          boxShadow: 'inset 0 0 0 2px rgba(201,166,107,0.25), 0 2px 6px rgba(0,0,0,0.4)',
        }}
      />
    );
  }

  const red = card.suit === 'h' || card.suit === 'd';
  const color = red ? '#bf3b2e' : '#1c1c1a';
  return (
    <div
      className={`${s.box} relative flex flex-col items-center justify-center rounded-[6px] border border-black/10 shadow-md`}
      style={{ background: 'linear-gradient(160deg, #faf6ec, #ece3cf)' }}
    >
      <span
        className={`absolute left-1 top-0.5 font-bold leading-none ${s.rank}`}
        style={{ color, fontFamily: 'var(--font-mono)' }}
      >
        {card.rank}
      </span>
      <span className={`${s.suit} leading-none`} style={{ color }}>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}
