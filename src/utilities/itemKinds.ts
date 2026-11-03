import type { OrderItem } from '@app/types/types';

// Spec 0028 (row 103): drinks and sides, the items riders most often leave behind, come first on the
// pickup checklist. A pure, stable order: drinks, then sides, then the rest, each as the restaurant sent
// them. Each item keeps its index in the order sent, which the ticks are keyed by.
export type SortedItem = { item: OrderItem; sentIndex: number };

const RANK: Record<string, number> = { DRINK: 0, SIDE: 1 };

export const itemsDrinksFirst = (items: OrderItem[]): SortedItem[] =>
  items
    .map((item, sentIndex) => ({ item, sentIndex }))
    .sort(
      (a, b) =>
        (RANK[a.item.kind ?? ''] ?? 2) - (RANK[b.item.kind ?? ''] ?? 2) ||
        a.sentIndex - b.sentIndex,
    );

// How many drinks and sides, counting quantities (a missing or non positive quantity counts as 1).
export const kindCounts = (
  items: OrderItem[],
): { drinks: number; sides: number } => {
  let drinks = 0;
  let sides = 0;
  for (const item of items) {
    const quantity = item.quantity > 0 ? item.quantity : 1;
    if (item.kind === 'DRINK') {
      drinks += quantity;
    }
    if (item.kind === 'SIDE') {
      sides += quantity;
    }
  }
  return { drinks, sides };
};
