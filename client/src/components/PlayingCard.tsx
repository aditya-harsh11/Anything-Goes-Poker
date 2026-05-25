import { type Card, SUIT_SYMBOL } from '@poker/shared';

interface Props {
  card?: Card;
  hidden?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZES = {
  xs: 'w-7 h-10 text-sm',
  sm: 'w-10 h-14 text-lg',
  md: 'w-12 h-16 text-2xl',
  lg: 'w-16 h-24 text-4xl',
};

export default function PlayingCard({ card, hidden, size = 'md' }: Props) {
  const dims = SIZES[size];

  if (hidden || !card) {
    return (
      <div
        className={`${dims} rounded-md border border-blue-900 bg-gradient-to-br from-blue-700 to-blue-900 shadow`}
      />
    );
  }

  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <div
      className={`${dims} flex flex-col items-center justify-center rounded-md border border-gray-300 bg-white font-bold leading-none shadow ${
        red ? 'text-red-600' : 'text-gray-900'
      }`}
    >
      <span>{card.rank}</span>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}
