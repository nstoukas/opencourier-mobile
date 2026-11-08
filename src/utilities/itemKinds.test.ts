import type { OrderItem } from '@app/types/types';
import { itemsDrinksFirst, kindCounts } from './itemKinds';

// Spec 0028 (row 103), AC-4: the sheet's order and the line's counts.
const item = (
  name: string,
  kind?: 'DRINK' | 'SIDE',
  quantity: number | undefined = 1,
): OrderItem =>
  ({
    name,
    quantity,
    ...(kind ? { kind } : {}),
  } as unknown as OrderItem);

describe('itemsDrinksFirst (spec 0028 AC-4)', () => {
  it('lists drinks, then sides, then the rest, each in the order sent, keeping sentIndex', () => {
    const items = [
      item('Souvlaki'),
      item('Fries', 'SIDE'),
      item('Cola', 'DRINK'),
      item('Pita'),
      item('Water', 'DRINK'),
      item('Tzatziki', 'SIDE'),
    ];

    const sorted = itemsDrinksFirst(items);

    expect(sorted.map(s => [s.item.name, s.sentIndex])).toEqual([
      ['Cola', 2],
      ['Water', 4],
      ['Fries', 1],
      ['Tzatziki', 5],
      ['Souvlaki', 0],
      ['Pita', 3],
    ]);
  });

  it('each entry carries the very item object sent at its sentIndex', () => {
    const items = [item('A'), item('B', 'SIDE'), item('C', 'DRINK')];
    for (const { item: sortedItem, sentIndex } of itemsDrinksFirst(items)) {
      expect(sortedItem).toBe(items[sentIndex]);
    }
  });

  it('is stable: many items of the same kind keep the order sent', () => {
    // Long enough that an unstable sort would show it.
    const items = Array.from({ length: 30 }, (_, i) =>
      item(
        `Item ${i}`,
        i % 3 === 0 ? 'DRINK' : i % 3 === 1 ? 'SIDE' : undefined,
      ),
    );

    const sorted = itemsDrinksFirst(items);

    const drinks = sorted
      .filter(s => s.item.kind === 'DRINK')
      .map(s => s.sentIndex);
    const sides = sorted
      .filter(s => s.item.kind === 'SIDE')
      .map(s => s.sentIndex);
    const rest = sorted.filter(s => !s.item.kind).map(s => s.sentIndex);
    expect(drinks).toEqual([...drinks].sort((a, b) => a - b));
    expect(sides).toEqual([...sides].sort((a, b) => a - b));
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
    expect(sorted.map(s => s.sentIndex)).toEqual([
      ...drinks,
      ...sides,
      ...rest,
    ]);
  });

  it('with no marks, keeps the order sent exactly', () => {
    const items = [item('C'), item('A'), item('B')];
    expect(itemsDrinksFirst(items).map(s => s.sentIndex)).toEqual([0, 1, 2]);
  });

  it('does not change the array it was given', () => {
    const items = [item('Pita'), item('Cola', 'DRINK')];
    const copy = [...items];
    itemsDrinksFirst(items);
    expect(items).toEqual(copy);
    expect(items[0].name).toBe('Pita');
  });

  it('returns an empty list for no items', () => {
    expect(itemsDrinksFirst([])).toEqual([]);
  });
});

describe('kindCounts (spec 0028 AC-4)', () => {
  it('sums quantities per kind', () => {
    expect(
      kindCounts([
        item('Cola', 'DRINK', 2),
        item('Water', 'DRINK', 1),
        item('Fries', 'SIDE', 3),
        item('Souvlaki', undefined, 5),
      ]),
    ).toEqual({ drinks: 3, sides: 3 });
  });

  it('counts a missing, zero or negative quantity as 1', () => {
    expect(
      kindCounts([
        item('Cola', 'DRINK', undefined),
        item('Water', 'DRINK', 0),
        item('Fries', 'SIDE', -2),
      ]),
    ).toEqual({ drinks: 2, sides: 1 });
    expect(
      kindCounts([{ name: 'Ayran', kind: 'DRINK' } as unknown as OrderItem]),
    ).toEqual({ drinks: 1, sides: 0 });
  });

  it('is zero and zero with no marks', () => {
    expect(kindCounts([item('Souvlaki', undefined, 4)])).toEqual({
      drinks: 0,
      sides: 0,
    });
  });
});
