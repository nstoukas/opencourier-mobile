import i18n from '@app/localization/i18n';
import {
  changedWords,
  jobEditedLine,
  jobEditedNoticeText,
  parseJobEdited,
  JobEdited,
} from './jobEdits';

// Row 164 (AC-1, AC-2): parsing JOB_EDITED payloads from live connection and push,
// and wording them for the job card and notification using real translations.
const t = i18n.t.bind(i18n) as never;

describe('parseJobEdited (row 164, AC-2)', () => {
  const livePayload = {
    deliveryId: 'del-123',
    restaurantName: 'Volos Kitchen',
    changed: ['NOTES', 'TIMES'],
    editedAt: '2026-11-25T14:30:00.000Z',
  };

  const pushPayload = {
    type: 'JOB_EDITED',
    deliveryId: 'del-123',
    restaurantName: 'Volos Kitchen',
    changed: 'NOTES,TIMES',
    editedAt: '2026-11-25T14:30:00.000Z',
  };

  it('live and push shapes give the exact same result', () => {
    const fromLive = parseJobEdited(livePayload);
    const fromPush = parseJobEdited(pushPayload);

    expect(fromLive).toEqual({
      deliveryId: 'del-123',
      restaurantName: 'Volos Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });
    expect(fromPush).toEqual(fromLive);
  });

  it('preserves fixed order (NOTES, TIMES) and filters duplicate kinds', () => {
    // Array with reversed order and duplicates
    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: ['TIMES', 'NOTES', 'NOTES'],
        editedAt: '2026-11-25T14:30:00.000Z',
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: 'Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });

    // Comma-joined string with reversed order and duplicates
    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: 'TIMES,NOTES,TIMES',
        editedAt: '2026-11-25T14:30:00.000Z',
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: 'Kitchen',
      changed: ['NOTES', 'TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });
  });

  it('drops unknown kinds and keeps only known fields', () => {
    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: ['NOTES', 'UNKNOWN_FIELD', 'PRICE'],
        editedAt: '2026-11-25T14:30:00.000Z',
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: 'Kitchen',
      changed: ['NOTES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: 'FOO,TIMES,BAR',
        editedAt: '2026-11-25T14:30:00.000Z',
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: 'Kitchen',
      changed: ['TIMES'],
      editedAt: '2026-11-25T14:30:00.000Z',
    });
  });

  it('defaults missing or non-string restaurantName and editedAt to empty string', () => {
    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        changed: ['NOTES'],
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: '',
      changed: ['NOTES'],
      editedAt: '',
    });

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 123,
        changed: ['TIMES'],
        editedAt: null,
      }),
    ).toEqual({
      deliveryId: 'del-1',
      restaurantName: '',
      changed: ['TIMES'],
      editedAt: '',
    });
  });

  it('returns null for non-object inputs', () => {
    expect(parseJobEdited(null)).toBeNull();
    expect(parseJobEdited(undefined)).toBeNull();
    expect(parseJobEdited('')).toBeNull();
    expect(parseJobEdited(123)).toBeNull();
    expect(parseJobEdited(true)).toBeNull();
  });

  it('returns null when deliveryId is missing, empty or not a string', () => {
    expect(
      parseJobEdited({
        restaurantName: 'Kitchen',
        changed: ['NOTES'],
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: '',
        restaurantName: 'Kitchen',
        changed: ['NOTES'],
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: 12345,
        restaurantName: 'Kitchen',
        changed: ['NOTES'],
      }),
    ).toBeNull();
  });

  it('returns null when changed contains no known kind or is empty', () => {
    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: [],
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: '',
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: ['UNKNOWN', 'OTHER'],
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
        changed: 'FOO,BAR',
      }),
    ).toBeNull();

    expect(
      parseJobEdited({
        deliveryId: 'del-1',
        restaurantName: 'Kitchen',
      }),
    ).toBeNull();
  });
});

describe('wording in English and Greek (row 164, AC-1, AC-2)', () => {
  const baseUpdate: JobEdited = {
    deliveryId: 'del-1',
    restaurantName: 'R73 Kitchen',
    changed: ['NOTES'],
    editedAt: '2026-11-25T12:00:00.000Z',
  };

  describe('English', () => {
    beforeAll(async () => {
      await i18n.changeLanguage('en');
    });

    it('changedWords: notes, times, and notes, times', () => {
      expect(changedWords(['NOTES'], t)).toBe('notes');
      expect(changedWords(['TIMES'], t)).toBe('times');
      expect(changedWords(['NOTES', 'TIMES'], t)).toBe('notes, times');
    });

    it('jobEditedNoticeText: formatted with restaurant name and changed words', () => {
      expect(jobEditedNoticeText(baseUpdate, t)).toBe('R73 Kitchen: notes');
      expect(
        jobEditedNoticeText({ ...baseUpdate, changed: ['TIMES'] }, t),
      ).toBe('R73 Kitchen: times');
      expect(
        jobEditedNoticeText({ ...baseUpdate, changed: ['NOTES', 'TIMES'] }, t),
      ).toBe('R73 Kitchen: notes, times');
    });

    it('jobEditedLine: "Restaurant changed: <what>", or empty string when no changed fields', () => {
      expect(jobEditedLine(['NOTES'], t)).toBe('Restaurant changed: notes');
      expect(jobEditedLine(['TIMES'], t)).toBe('Restaurant changed: times');
      expect(jobEditedLine(['NOTES', 'TIMES'], t)).toBe(
        'Restaurant changed: notes, times',
      );
      expect(jobEditedLine([], t)).toBe('');
    });
  });

  describe('Greek', () => {
    beforeAll(async () => {
      await i18n.changeLanguage('el');
    });

    afterAll(async () => {
      await i18n.changeLanguage('en');
    });

    it('changedWords: σημειώσεις, ώρες, and σημειώσεις, ώρες', () => {
      expect(changedWords(['NOTES'], t)).toBe('σημειώσεις');
      expect(changedWords(['TIMES'], t)).toBe('ώρες');
      expect(changedWords(['NOTES', 'TIMES'], t)).toBe('σημειώσεις, ώρες');
    });

    it('jobEditedNoticeText: formatted with restaurant name and changed words', () => {
      expect(jobEditedNoticeText(baseUpdate, t)).toBe('R73 Kitchen: σημειώσεις');
      expect(
        jobEditedNoticeText({ ...baseUpdate, changed: ['TIMES'] }, t),
      ).toBe('R73 Kitchen: ώρες');
      expect(
        jobEditedNoticeText({ ...baseUpdate, changed: ['NOTES', 'TIMES'] }, t),
      ).toBe('R73 Kitchen: σημειώσεις, ώρες');
    });

    it('jobEditedLine: "Αλλαγή από το κατάστημα: <what>", or empty string when no changed fields', () => {
      expect(jobEditedLine(['NOTES'], t)).toBe(
        'Αλλαγή από το κατάστημα: σημειώσεις',
      );
      expect(jobEditedLine(['TIMES'], t)).toBe(
        'Αλλαγή από το κατάστημα: ώρες',
      );
      expect(jobEditedLine(['NOTES', 'TIMES'], t)).toBe(
        'Αλλαγή από το κατάστημα: σημειώσεις, ώρες',
      );
      expect(jobEditedLine([], t)).toBe('');
    });
  });
});
