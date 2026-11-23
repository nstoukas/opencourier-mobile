import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { boxSizeLine, itemSizeWord } from './boxSize';

describe('boxSizeLine (spec 0043, AC-7)', () => {
  const t = i18n.t.bind(i18n);

  it('words each of the three sizes as "Small order", "Medium order", or "Large order"', () => {
    expect(boxSizeLine('SMALL', t)).toBe('Small order');
    expect(boxSizeLine('MEDIUM', t)).toBe('Medium order');
    expect(boxSizeLine('LARGE', t)).toBe('Large order');
  });

  it('returns empty string for null, undefined, empty string, and unknown sizes without calling translation', () => {
    const mockT = jest.fn((key: string) => `translations:${key}`);

    // Missing values
    expect(boxSizeLine(null, mockT)).toBe('');
    expect(boxSizeLine(undefined, mockT)).toBe('');
    expect(boxSizeLine('', mockT)).toBe('');

    // Unknown values (must never return a raw key like "translations:box_size_order_HUGE")
    expect(boxSizeLine('HUGE', mockT)).toBe('');
    expect(boxSizeLine('EXTRA_LARGE', mockT)).toBe('');
    expect(boxSizeLine('TINY', mockT)).toBe('');
    expect(boxSizeLine('small', mockT)).toBe(''); // wrong casing

    // Confirm translation function was never invoked for any invalid input
    expect(mockT).not.toHaveBeenCalled();
  });

  it('never returns a raw key when evaluated with real translations for unknown size', () => {
    expect(boxSizeLine('HUGE', t)).toBe('');
    expect(boxSizeLine('HUGE', t)).not.toContain('translations:');
    expect(boxSizeLine('HUGE', t)).not.toContain('box_size_order');
  });
});

// Row 137 (the tour, problem 24): one item's size on the items sheet, in the app's language.
describe('itemSizeWord (row 137)', () => {
  const t = i18n.t.bind(i18n);

  afterEach(async () => {
    // jest.setup.js pins English; a Greek test must hand it back.
    await i18n.changeLanguage('en');
  });

  it('words each of the three sizes in English: "Small", "Medium", "Large"', () => {
    expect(itemSizeWord('SMALL', t)).toBe('Small');
    expect(itemSizeWord('MEDIUM', t)).toBe('Medium');
    expect(itemSizeWord('LARGE', t)).toBe('Large');
  });

  it('words each of the three sizes in Greek: "Μικρό", "Μεσαίο", "Μεγάλο"', async () => {
    await i18n.changeLanguage('el');
    expect(itemSizeWord('SMALL', t)).toBe('Μικρό');
    expect(itemSizeWord('MEDIUM', t)).toBe('Μεσαίο');
    expect(itemSizeWord('LARGE', t)).toBe('Μεγάλο');
  });

  it('reads the size in any letter case ("Large", "small", "mEdIuM")', async () => {
    expect(itemSizeWord('Large', t)).toBe('Large');
    expect(itemSizeWord('small', t)).toBe('Small');
    expect(itemSizeWord('mEdIuM', t)).toBe('Medium');
    await i18n.changeLanguage('el');
    expect(itemSizeWord('Large', t)).toBe('Μεγάλο');
    expect(itemSizeWord('small', t)).toBe('Μικρό');
  });

  it('gives nothing for a missing or unknown size, without asking for a translation', () => {
    const mockT = jest.fn((key: string) => key);

    expect(itemSizeWord(null, mockT)).toBe('');
    expect(itemSizeWord(undefined, mockT)).toBe('');
    expect(itemSizeWord('', mockT)).toBe('');
    expect(itemSizeWord('XL', mockT)).toBe('');
    expect(itemSizeWord('xl', mockT)).toBe('');
    expect(itemSizeWord('HUGE', mockT)).toBe('');
    expect(itemSizeWord(' SMALL', mockT)).toBe('');
    expect(itemSizeWord('SMALL order', mockT)).toBe('');

    expect(mockT).not.toHaveBeenCalled();
  });

  it('never gives back the raw value or a bare key', async () => {
    for (const language of ['en', 'el']) {
      await i18n.changeLanguage(language);
      for (const size of ['SMALL', 'MEDIUM', 'LARGE', 'small', 'XL', 'HUGE']) {
        const word = itemSizeWord(size, t);
        expect(word).not.toBe(size);
        expect(word).not.toBe(size.toUpperCase());
        expect(word).not.toContain('item_size');
        expect(word).not.toContain('translations:');
      }
    }
  });
});
