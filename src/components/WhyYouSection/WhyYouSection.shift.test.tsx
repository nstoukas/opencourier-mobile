import React from 'react';
import { render, screen } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { EarningsWhyYou } from '@app/types/earnings';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { WhyYouSection, whyYouLines } from './WhyYouSection';

// Spec 0049 (row 79, AC-3): the rider's "Why you got this" says "you were on a booked shift" when it
// applied. Written from the spec, with the app's real English strings. The server sends a weight only
// when it applied and is above 0, and `onShift` only for an offer made while shifts were on.

const t = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(key, options as any) as unknown as string;
const euros = (cents: number) => formatCurrencyFromCents(cents, 'EUR');

const ON_SHIFT = 'You were on a booked shift';

const fairness = (over: Partial<EarningsWhyYou> = {}): EarningsWhyYou => ({
  strategy: 'FAIRNESS',
  kind: 'OFFER',
  values: { roadSeconds: 480, centsPerHour: 940, waitingSeconds: 1320 },
  weights: { roadTime: 50, earnings: 30, waiting: 20 },
  estimated: false,
  ...over,
});

// The same offer, made while shifts were on with the given shift weight and onShift value.
const withShift = (
  onShift: number | boolean | string | null | undefined,
  shiftWeight?: number,
): EarningsWhyYou => {
  const base = fairness();
  return {
    ...base,
    values: onShift === undefined ? base.values : { ...base.values, onShift },
    weights:
      shiftWeight === undefined
        ? base.weights
        : { ...base.weights, shift: shiftWeight },
  };
};

describe('whyYouLines and the booked shift (spec 0049, AC-3)', () => {
  it('says "You were on a booked shift" when the shift weight is present and onShift is true', () => {
    const lines = whyYouLines(withShift(true, 40), t, euros);
    expect(lines).toContain(ON_SHIFT);
  });

  it('puts the line after waiting and before the weights, and the weights name the booked shift', () => {
    expect(whyYouLines(withShift(true, 40), t, euros)).toEqual([
      '8 min to the restaurant',
      '€9.40 an hour online today',
      'Waited 22 min since your last job or going Online',
      ON_SHIFT,
      'The co-op weighs road time 50, earnings 30, waiting 20, your booked shift 40',
    ]);
  });

  it('does not say it when the rider was not on a booked shift', () => {
    const lines = whyYouLines(withShift(false, 40), t, euros);
    expect(lines).not.toContain(ON_SHIFT);
    // The weight still counted for the offer, so it is still named.
    expect(lines[lines.length - 1]).toBe(
      'The co-op weighs road time 50, earnings 30, waiting 20, your booked shift 40',
    );
  });

  it('does not say it when the shift weight did not count (the server sends no weight at 0)', () => {
    const lines = whyYouLines(withShift(true), t, euros);
    expect(lines).not.toContain(ON_SHIFT);
    expect(lines).toEqual([
      '8 min to the restaurant',
      '€9.40 an hour online today',
      'Waited 22 min since your last job or going Online',
      'The co-op weighs road time 50, earnings 30, waiting 20',
    ]);
  });

  it('does not say it for an offer made with shifts off (no onShift, no shift weight)', () => {
    const lines = whyYouLines(fairness(), t, euros);
    expect(lines.join(' ')).not.toMatch(/shift/i);
  });

  it('does not say it when the weight is there but onShift is missing', () => {
    expect(whyYouLines(withShift(undefined, 40), t, euros)).not.toContain(
      ON_SHIFT,
    );
  });

  it.each([['true'], [1], [null]])(
    'only a real true counts: onShift %p is not worded',
    value => {
      expect(whyYouLines(withShift(value, 40), t, euros)).not.toContain(
        ON_SHIFT,
      );
    },
  );

  it('with only the shift weight counting, the shift is the reason given', () => {
    const lines = whyYouLines(
      fairness({
        values: { roadSeconds: 480, waitingSeconds: 1320, onShift: true },
        weights: { shift: 100 },
      }),
      t,
      euros,
    );
    expect(lines).toEqual([ON_SHIFT, 'The co-op weighs your booked shift 100']);
  });

  it.each(['NEAREST_COURIER', 'COURIER_SENIORITY', 'ADMIN', 'STATIC'])(
    'never says it under %s (shifts change nothing under another matcher)',
    strategy => {
      const lines = whyYouLines({ ...withShift(true, 40), strategy }, t, euros);
      expect(lines).not.toContain(ON_SHIFT);
    },
  );

  // Value 5: the rider's own yes or no, never a place in line or a mark against them.
  it('has no words for not being on a shift', () => {
    const lines = whyYouLines(withShift(false, 40), t, euros);
    expect(lines.join(' ')).not.toMatch(/not on a|no booked|without a shift/i);
  });
});

describe('WhyYouSection and the booked shift (spec 0049, AC-3)', () => {
  it('shows "You were on a booked shift" on the job\'s Why you got this card', () => {
    render(
      <WhyYouSection
        whyYou={withShift(true, 40)}
        money={euros}
        onHowItWorks={() => {}}
      />,
    );
    expect(screen.getByText('Why you got this')).toBeTruthy();
    expect(screen.getByText(ON_SHIFT)).toBeTruthy();
  });

  it('does not show it for a job offered with shifts off', () => {
    render(
      <WhyYouSection
        whyYou={fairness()}
        money={euros}
        onHowItWorks={() => {}}
      />,
    );
    expect(screen.queryByText(ON_SHIFT)).toBeNull();
  });
});
