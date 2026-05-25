// Minimal ambient types for the untyped, CommonJS `pokersolver` package.
declare module 'pokersolver' {
  class Hand {
    name: string;
    descr: string;
    rank: number;
    cards: { value: string; suit: string; toString(): string }[];
    /** Build the best hand from card strings like ["As", "Kd", ...]. */
    static solve(cards: string[], game?: string, canDisqualify?: boolean): Hand;
    /** Returns the winning Hand(s) among the given solved hands. */
    static winners(hands: Hand[]): Hand[];
    toString(): string;
  }
  const pokersolver: { Hand: typeof Hand };
  export default pokersolver;
}
