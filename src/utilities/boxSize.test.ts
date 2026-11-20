import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { boxSizeLine } from './boxSize';

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
