// Spec 0043 (row 9, AC-7): the order's box size, as the backend sends it on an
// offer and a job. The co-op's settings turn it into box units on the server;
// the phone only words it ("Medium order"). No box gauge anywhere.
export type BoxSize = 'SMALL' | 'MEDIUM' | 'LARGE';

const BOX_SIZES: readonly string[] = ['SMALL', 'MEDIUM', 'LARGE'];

// "Small order", "Medium order" or "Large order"; '' when the server sent no
// size or one this app does not know (an older server, a newer size), so the
// card simply leaves the line out.
export const boxSizeLine = (
  boxSize: string | null | undefined,
  t: (key: string) => string,
): string =>
  boxSize && BOX_SIZES.includes(boxSize)
    ? t(`translations:box_size_order_${boxSize}`)
    : '';

// Row 137 (the tour, problem 24): an item's own size on the items sheet, in the app's language
// ("Small", "Μικρό"); '' for a size this app does not know, never the raw value ("SMALL").
export const itemSizeWord = (
  size: string | null | undefined,
  t: (key: string) => string,
): string =>
  size && BOX_SIZES.includes(size) ? t(`translations:item_size_${size}`) : '';
