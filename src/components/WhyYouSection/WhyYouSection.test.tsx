import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '@app/localization/i18n';
import { EarningsWhyYou } from '@app/types/earnings';
import { formatCurrencyFromCents } from '@app/utilities/currency';
import { WhyYouSection, durationWords, whyYouLines } from './WhyYouSection';

// Spec 0045 (row 14), written from the spec's acceptance criteria and its cross check, with the app's
// real English strings (no mocked translations).

const t = (key: string, options?: Record<string, unknown>): string =>
  i18n.t(key, options as any) as unknown as string;
const euros = (cents: number) => formatCurrencyFromCents(cents, 'EUR');

const NONE = 'No reason was recorded for this job.';

const fairness = (over: Partial<EarningsWhyYou> = {}): EarningsWhyYou => ({
  strategy: 'FAIRNESS',
  kind: 'OFFER',
  values: { roadSeconds: 480, centsPerHour: 940, waitingSeconds: 1320 },
  weights: { roadTime: 50, earnings: 30, waiting: 20 },
  estimated: false,
  ...over,
});

const reason = (
  strategy: string,
  values: EarningsWhyYou['values'] = {},
): EarningsWhyYou => ({
  strategy,
  kind: 'OFFER',
  values,
  weights: {},
  estimated: false,
});

describe('durationWords (spec 0045, AC-2)', () => {
  it('says "under a minute" below half a minute', () => {
    expect(durationWords(0, t)).toBe('under a minute');
    expect(durationWords(29, t)).toBe('under a minute');
  });

  it('gives whole minutes under an hour', () => {
    expect(durationWords(60, t)).toBe('1 min');
    expect(durationWords(480, t)).toBe('8 min');
    expect(durationWords(1320, t)).toBe('22 min');
    expect(durationWords(59 * 60, t)).toBe('59 min');
  });

  it('gives hours with zero padded minutes from an hour up', () => {
    expect(durationWords(3600, t)).toBe('1 h 00 min');
    expect(durationWords(3900, t)).toBe('1 h 05 min');
    expect(durationWords(2 * 3600 + 40 * 60, t)).toBe('2 h 40 min');
  });
});

describe('whyYouLines (spec 0045, AC-2, AC-3, AC-6)', () => {
  describe('FAIRNESS', () => {
    it('gives the road, pay per hour, waiting and weights lines, in that order', () => {
      expect(whyYouLines(fairness(), t, euros)).toEqual([
        '8 min to the restaurant',
        '€9.40 an hour online today',
        'Waited 22 min since your last job or going Online',
        'The co-op weighs road time 50, earnings 30, waiting 20',
      ]);
    });

    it('marks the road time as estimated when the fallback was used', () => {
      const lines = whyYouLines(fairness({ estimated: true }), t, euros);
      expect(lines[0]).toBe(
        'About 8 min to the restaurant (estimated, the route could not be worked out)',
      );
      expect(lines).not.toContain('8 min to the restaurant');
    });

    it('does not say estimated when the road time was routed', () => {
      const lines = whyYouLines(fairness({ estimated: false }), t, euros);
      expect(lines.join('\n')).not.toMatch(/estimated/i);
    });

    it('writes pay per hour in the money format it is given', () => {
      const custom = (cents: number) => `${cents} lepta`;
      expect(whyYouLines(fairness(), t, custom)).toContain(
        '940 lepta an hour online today',
      );
    });

    it('says the average counted when earningsAssumed is true, with no pay per hour figure', () => {
      const lines = whyYouLines(
        fairness({
          values: {
            roadSeconds: 480,
            centsPerHour: 940,
            earningsAssumed: true,
            waitingSeconds: 1320,
          },
        }),
        t,
        euros,
      );
      expect(lines[1]).toBe(
        "You had little time online today, so the co-op's average counted for you",
      );
      expect(lines.join('\n')).not.toContain('an hour online today');
      expect(lines).toHaveLength(4);
    });

    it('says earnings counted the same for everyone when earningsEqual is true', () => {
      const lines = whyYouLines(
        fairness({
          values: {
            roadSeconds: 480,
            centsPerHour: 940,
            earningsEqual: true,
            waitingSeconds: 1320,
          },
        }),
        t,
        euros,
      );
      expect(lines[1]).toBe('Earnings counted the same for everyone this time');
      expect(lines.join('\n')).not.toContain('an hour online today');
      expect(lines).toHaveLength(4);
    });

    it('lists only the weights present, in the order given', () => {
      const two = whyYouLines(
        fairness({ weights: { roadTime: 70, waiting: 30 } }),
        t,
        euros,
      );
      expect(two[two.length - 1]).toBe(
        'The co-op weighs road time 70, waiting 30',
      );

      const withShift = whyYouLines(
        fairness({
          weights: { roadTime: 40, earnings: 30, waiting: 20, shift: 10 },
        }),
        t,
        euros,
      );
      expect(withShift[withShift.length - 1]).toBe(
        'The co-op weighs road time 40, earnings 30, waiting 20, your booked shift 10',
      );

      const reordered = whyYouLines(
        fairness({ weights: { waiting: 60, roadTime: 40 } }),
        t,
        euros,
      );
      expect(reordered[reordered.length - 1]).toBe(
        'The co-op weighs waiting 60, road time 40',
      );
    });

    it('leaves the weights line out when no weight applied', () => {
      const lines = whyYouLines(fairness({ weights: {} }), t, euros);
      expect(lines).toEqual([
        '8 min to the restaurant',
        '€9.40 an hour online today',
        'Waited 22 min since your last job or going Online',
      ]);
    });

    it('leaves out a line whose value is missing rather than printing a blank', () => {
      const lines = whyYouLines(
        fairness({ values: { roadSeconds: 480 } }),
        t,
        euros,
      );
      expect(lines).toEqual([
        '8 min to the restaurant',
        'The co-op weighs road time 50, earnings 30, waiting 20',
      ]);
    });
  });

  it('NEAREST_COURIER names the distance in km to one decimal', () => {
    expect(
      whyYouLines(
        reason('NEAREST_COURIER', { straightMetres: 1200 }),
        t,
        euros,
      ),
    ).toEqual(['You were the nearest rider (1.2 km)']);
  });

  it('NEAREST_COURIER without a distance gives the plain sentence', () => {
    expect(whyYouLines(reason('NEAREST_COURIER'), t, euros)).toEqual([
      'You were the nearest rider',
    ]);
  });

  it('COURIER_SENIORITY gives one sentence', () => {
    expect(
      whyYouLines(
        reason('COURIER_SENIORITY', { memberSince: '2024-03-01' }),
        t,
        euros,
      ),
    ).toEqual(['The co-op offers to its longest serving members first']);
  });

  it.each(['ADMIN', 'STATIC'])('%s says Dispatch gave the job', strategy => {
    expect(whyYouLines(reason(strategy), t, euros)).toEqual([
      'Dispatch gave you this job',
    ]);
  });

  it('null gives the fallback line, never an empty list (AC-3)', () => {
    expect(whyYouLines(null, t, euros)).toEqual([NONE]);
  });

  it('an unknown strategy gives the same fallback', () => {
    expect(
      whyYouLines(
        reason('SOME_FUTURE_MATCHER', { roadSeconds: 480 }),
        t,
        euros,
      ),
    ).toEqual([NONE]);
  });
});

describe('what a line never shows (spec 0045 cross check 1 and 5)', () => {
  // Keys the server should never send, with figures that appear nowhere else in the reason.
  const forbidden = {
    score: 0.8734,
    scaled: 0.6157,
    roadScaled: 0.4283,
    earningsScaled: 0.7391,
    waitingScaled: 0.2649,
    candidateCount: 7777,
    ridersInRange: 6666,
    tipsCents: 3333,
    tips: 4444,
  };
  const forbiddenFigures =
    /8734|6157|4283|7391|2649|7777|6666|3333|4444|33\.33|44\.44/;

  const everyReason: [string, EarningsWhyYou | null][] = [
    ['fairness', fairness()],
    ['fairness, estimated', fairness({ estimated: true })],
    [
      'fairness, average used',
      fairness({
        values: {
          roadSeconds: 480,
          earningsAssumed: true,
          waitingSeconds: 1320,
        },
      }),
    ],
    [
      'fairness, earnings equal',
      fairness({
        values: { roadSeconds: 480, earningsEqual: true, waitingSeconds: 1320 },
      }),
    ],
    [
      'fairness, every weight',
      fairness({
        weights: { roadTime: 40, earnings: 30, waiting: 20, shift: 10 },
      }),
    ],
    ['nearest', reason('NEAREST_COURIER', { straightMetres: 1200 })],
    ['nearest, plain', reason('NEAREST_COURIER')],
    ['seniority', reason('COURIER_SENIORITY')],
    ['admin', reason('ADMIN')],
    ['static', reason('STATIC')],
    ['unknown', reason('SOME_FUTURE_MATCHER')],
    ['none', null],
  ];

  it.each(everyReason)('%s: no line mentions tips', (_name, whyYou) => {
    const withTips = whyYou && {
      ...whyYou,
      values: { ...whyYou.values, tipsCents: 3333, tips: 4444 },
    };
    const text = whyYouLines(withTips, t, euros).join('\n');
    expect(text).not.toMatch(/tip/i);
    expect(text).not.toMatch(forbiddenFigures);
  });

  it.each(everyReason.filter(([, whyYou]) => whyYou !== null))(
    '%s: no score, scaled value or count of riders reaches a line, even when present in values',
    (_name, whyYou) => {
      const clean = whyYouLines(whyYou, t, euros);
      const dirty = whyYouLines(
        { ...whyYou!, values: { ...whyYou!.values, ...forbidden } },
        t,
        euros,
      );
      // The extra keys change nothing at all.
      expect(dirty).toEqual(clean);
      const text = dirty.join('\n');
      expect(text).not.toMatch(forbiddenFigures);
      expect(text).not.toMatch(/score|scaled|candidates?|riders in range/i);
    },
  );

  it('a weight the app does not know (a score or a count) is not listed', () => {
    const lines = whyYouLines(
      fairness({
        weights: { roadTime: 50, score: 8734, candidateCount: 7777 },
      }),
      t,
      euros,
    );
    expect(lines[lines.length - 1]).toBe('The co-op weighs road time 50');
  });
});

describe('WhyYouSection (spec 0045, AC-2 to AC-4)', () => {
  it('renders the title, every line and the link, and the link calls onHowItWorks', () => {
    const onHowItWorks = jest.fn();
    render(
      <WhyYouSection
        whyYou={fairness()}
        money={euros}
        onHowItWorks={onHowItWorks}
      />,
    );

    expect(screen.getByTestId('earnings-why-you')).toBeTruthy();
    expect(screen.getByText('Why you got this')).toBeTruthy();
    expect(screen.getByText('8 min to the restaurant')).toBeTruthy();
    expect(screen.getByText('€9.40 an hour online today')).toBeTruthy();
    expect(
      screen.getByText('Waited 22 min since your last job or going Online'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The co-op weighs road time 50, earnings 30, waiting 20',
      ),
    ).toBeTruthy();

    expect(onHowItWorks).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('How offers and pay work'));
    expect(onHowItWorks).toHaveBeenCalledTimes(1);
  });

  it('renders the fallback line with whyYou null, never an empty box', () => {
    render(
      <WhyYouSection whyYou={null} money={euros} onHowItWorks={jest.fn()} />,
    );
    expect(screen.getByText('Why you got this')).toBeTruthy();
    expect(screen.getByText(NONE)).toBeTruthy();
  });
});
