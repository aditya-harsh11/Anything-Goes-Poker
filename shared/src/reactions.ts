/** Emoji reactions players can throw at the table (e.g. to clown the loser). */
export const REACTIONS = ['🤡', '😂', '😎', '🔥', '💪', '😭', '👏', '🎉'] as const;

export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return typeof value === 'string' && (REACTIONS as readonly string[]).includes(value);
}
