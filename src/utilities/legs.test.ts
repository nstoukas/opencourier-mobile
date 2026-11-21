// Spec 0046 (row 10, AC-7): "Leg 1 of 2" on the offer card and the job card, so the rider
// knows a colleague carries the rest to the same door. Tests by a Fable subagent standing
// in for agy (decision R.25).
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { legLine } from './legs';

describe('legLine (spec 0046, AC-7)', () => {
  const t = i18n.t.bind(i18n);

  it('words a leg as "Leg 1 of 2"', () => {
    expect(legLine({ legNumber: 1, legCount: 2 }, t)).toBe('Leg 1 of 2');
    expect(legLine({ legNumber: 3, legCount: 4 }, t)).toBe('Leg 3 of 4');
  });

  it('is empty for a single delivery, and asks for no translation', () => {
    const mockT = jest.fn((key: string) => key);

    expect(legLine({ legNumber: null, legCount: null }, mockT)).toBe('');
    expect(legLine({}, mockT)).toBe('');
    expect(mockT).not.toHaveBeenCalled();
  });

  it('is empty when only one of the two labels is there', () => {
    expect(legLine({ legNumber: 1, legCount: null }, t)).toBe('');
    expect(legLine({ legNumber: null, legCount: 2 }, t)).toBe('');
    expect(legLine({ legNumber: 1 }, t)).toBe('');
  });

  it("is empty for the push's '' (decision 10.2: a single delivery sends '' for both)", () => {
    expect(legLine({ legNumber: '' as any, legCount: '' as any }, t)).toBe('');
  });

  it('never shows a raw translation key', () => {
    const line = legLine({ legNumber: 2, legCount: 3 }, t);
    expect(line).not.toContain('translations:');
    expect(line).not.toContain('order_leg_of');
    expect(line).not.toContain('{{');
  });
});
