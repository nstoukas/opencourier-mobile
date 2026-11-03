import i18n from '@app/localization/i18n';
import {
  JobReadyUpdate,
  minutesLeft,
  parseJobReadyUpdate,
  readyLine,
  readyNoticeText,
} from './readySignals';

// Spec 0023: the job card's ready line (AC-7) and the notice's words (AC-6).
// The real English translations, so the tests pin what the rider reads.
const t = i18n.t.bind(i18n) as never;

const NOW = Date.parse('2026-11-03T12:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('minutesLeft (spec 0023, AC-7)', () => {
  it('rounds up to whole minutes: 59 s is 1, 61 s is 2, exactly 8 min is 8', () => {
    expect(minutesLeft(NOW + 59 * SECOND, NOW)).toBe(1);
    expect(minutesLeft(NOW + 61 * SECOND, NOW)).toBe(2);
    expect(minutesLeft(NOW + 8 * MINUTE, NOW)).toBe(8);
    expect(minutesLeft(NOW + 8 * MINUTE + 1, NOW)).toBe(9);
  });

  it('never goes below 1, even for a single millisecond left', () => {
    expect(minutesLeft(NOW + 1, NOW)).toBe(1);
  });
});

describe('readyLine (spec 0023, AC-7)', () => {
  it('says "Ready" once foodReadyAt is set, whatever the ready time', () => {
    expect(
      readyLine(
        {
          foodReadyAt: '2026-11-03T11:58:00.000Z',
          readyAtOnPhone: NOW + 10 * MINUTE,
        },
        NOW,
        t,
      ),
    ).toBe('Ready');
    // Food ready with no ready time still reads Ready.
    expect(
      readyLine(
        { foodReadyAt: '2026-11-03T11:58:00.000Z', readyAtOnPhone: null },
        NOW,
        t,
      ),
    ).toBe('Ready');
  });

  it('says "Preparing, ~N min" with N rounded up while time is left', () => {
    expect(readyLine({ readyAtOnPhone: NOW + 59 * SECOND }, NOW, t)).toBe(
      'Preparing, ~1 min',
    );
    expect(readyLine({ readyAtOnPhone: NOW + 61 * SECOND }, NOW, t)).toBe(
      'Preparing, ~2 min',
    );
    expect(
      readyLine(
        { readyAtOnPhone: NOW + 8 * MINUTE, foodReadyAt: null },
        NOW,
        t,
      ),
    ).toBe('Preparing, ~8 min');
  });

  it('says "Preparing, due now" at the ready time and after it', () => {
    expect(readyLine({ readyAtOnPhone: NOW }, NOW, t)).toBe(
      'Preparing, due now',
    );
    expect(readyLine({ readyAtOnPhone: NOW - 5 * MINUTE }, NOW, t)).toBe(
      'Preparing, due now',
    );
  });

  it('shows nothing for an order with no ready time (made before ready times existed)', () => {
    expect(readyLine({ readyAtOnPhone: null }, NOW, t)).toBe('');
    expect(readyLine({ readyAtOnPhone: undefined }, NOW, t)).toBe('');
    expect(readyLine({}, NOW, t)).toBe('');
    expect(readyLine({ foodReadyAt: null, readyAtOnPhone: null }, NOW, t)).toBe(
      '',
    );
  });
});

describe('readyNoticeText (spec 0023, AC-6)', () => {
  const base: JobReadyUpdate = {
    deliveryId: 'del-1',
    restaurantName: 'R73 Kitchen',
    readyAt: null,
    foodReadyAt: null,
    delayMinutes: null,
  };

  it('food ready: "<restaurant>: food ready"', () => {
    expect(
      readyNoticeText(
        {
          ...base,
          readyAt: '2026-11-03T12:10:00.000Z',
          foodReadyAt: '2026-11-03T11:59:00.000Z',
        },
        NOW,
        t,
      ),
    ).toBe('R73 Kitchen: food ready');
  });

  it('a delay: "<restaurant>: +N min, ready in ~M min", M rounded up from the phone\'s now', () => {
    expect(
      readyNoticeText(
        {
          ...base,
          readyAt: new Date(NOW + 12 * MINUTE).toISOString(),
          delayMinutes: 10,
        },
        NOW,
        t,
      ),
    ).toBe('R73 Kitchen: +10 min, ready in ~12 min');
    expect(
      readyNoticeText(
        {
          ...base,
          readyAt: new Date(NOW + 4 * MINUTE + SECOND).toISOString(),
          delayMinutes: 5,
        },
        NOW,
        t,
      ),
    ).toBe('R73 Kitchen: +5 min, ready in ~5 min');
  });

  it('neither food ready nor a delay: "<restaurant>: the ready time changed"', () => {
    expect(
      readyNoticeText({ ...base, readyAt: '2026-11-03T12:10:00.000Z' }, NOW, t),
    ).toBe('R73 Kitchen: the ready time changed');
    // A delay with no readable ready time cannot say the minutes left.
    expect(readyNoticeText({ ...base, delayMinutes: 10 }, NOW, t)).toBe(
      'R73 Kitchen: the ready time changed',
    );
  });
});

describe('parseJobReadyUpdate (spec 0023, AC-6)', () => {
  it('reads a live message with typed values', () => {
    expect(
      parseJobReadyUpdate({
        deliveryId: 'del-live',
        restaurantName: 'R73 Kitchen',
        readyAt: '2026-11-03T12:10:00.000Z',
        foodReadyAt: null,
        delayMinutes: 10,
      }),
    ).toEqual({
      deliveryId: 'del-live',
      restaurantName: 'R73 Kitchen',
      readyAt: '2026-11-03T12:10:00.000Z',
      foodReadyAt: null,
      delayMinutes: 10,
    });
  });

  it("reads a push: every value text, '' for null, delayMinutes as text", () => {
    expect(
      parseJobReadyUpdate({
        type: 'JOB_READY_UPDATED',
        deliveryId: 'del-push',
        restaurantName: 'R73 Kitchen',
        readyAt: '2026-11-03T12:10:00.000Z',
        foodReadyAt: '',
        delayMinutes: '15',
      }),
    ).toEqual({
      deliveryId: 'del-push',
      restaurantName: 'R73 Kitchen',
      readyAt: '2026-11-03T12:10:00.000Z',
      foodReadyAt: null,
      delayMinutes: 15,
    });
  });

  it("reads a food ready push: delayMinutes '' becomes null", () => {
    expect(
      parseJobReadyUpdate({
        type: 'JOB_READY_UPDATED',
        deliveryId: 'del-push',
        restaurantName: 'R73 Kitchen',
        readyAt: '2026-11-03T12:10:00.000Z',
        foodReadyAt: '2026-11-03T12:01:00.000Z',
        delayMinutes: '',
      }),
    ).toEqual({
      deliveryId: 'del-push',
      restaurantName: 'R73 Kitchen',
      readyAt: '2026-11-03T12:10:00.000Z',
      foodReadyAt: '2026-11-03T12:01:00.000Z',
      delayMinutes: null,
    });
  });

  it('a delayMinutes that is not a number becomes null', () => {
    expect(
      parseJobReadyUpdate({ deliveryId: 'del-x', delayMinutes: 'ten' })
        ?.delayMinutes,
    ).toBeNull();
  });

  it('returns null with no deliveryId, an empty one, or no object at all', () => {
    expect(
      parseJobReadyUpdate({ restaurantName: 'R73 Kitchen', delayMinutes: 10 }),
    ).toBeNull();
    expect(parseJobReadyUpdate({ deliveryId: '' })).toBeNull();
    expect(parseJobReadyUpdate({ deliveryId: 42 })).toBeNull();
    expect(parseJobReadyUpdate(null)).toBeNull();
    expect(parseJobReadyUpdate(undefined)).toBeNull();
    expect(parseJobReadyUpdate('del-1')).toBeNull();
  });
});
