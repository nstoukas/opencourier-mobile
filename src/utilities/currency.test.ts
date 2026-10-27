import { formatCurrencyFromCents, currencyFormatter } from './currency';

describe('formatCurrencyFromCents (Row 66)', () => {
  it('formats cents as major currency units in en-GB locale', () => {
    expect(formatCurrencyFromCents(194, 'EUR')).toBe('€1.94');
    expect(formatCurrencyFromCents(1000, 'EUR')).toBe('€10.00');
    expect(formatCurrencyFromCents(0, 'EUR')).toBe('€0.00');
    expect(formatCurrencyFromCents(194, 'USD')).toBe('US$1.94');
    expect(formatCurrencyFromCents(1000, 'USD')).toBe('US$10.00');
    expect(formatCurrencyFromCents(0, 'USD')).toBe('US$0.00');
  });

  it('handles nullish amounts as zero in en-GB locale', () => {
    expect(formatCurrencyFromCents(undefined, 'EUR')).toBe('€0.00');
    expect(formatCurrencyFromCents(null, 'EUR')).toBe('€0.00');
    expect(formatCurrencyFromCents(undefined, 'USD')).toBe('US$0.00');
    expect(formatCurrencyFromCents(null, 'USD')).toBe('US$0.00');
  });

  it('falls back to EUR for missing, empty or invalid currency codes', () => {
    expect(formatCurrencyFromCents(100)).toBe('€1.00');
    expect(formatCurrencyFromCents(100, '')).toBe('€1.00');
    expect(formatCurrencyFromCents(100, 'NOTREAL')).toBe('€1.00');
    expect(formatCurrencyFromCents(100, null as any)).toBe('€1.00');
  });

  it('currencyFormatter formats major units with EUR fallback in en-GB', () => {
    expect(currencyFormatter(1.94)).toBe('€1.94');
  });
});
