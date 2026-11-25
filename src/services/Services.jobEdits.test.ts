import { services } from './service';
import * as jobEditMarksModule from './jobEdits/jobEditMarks';
import * as readyNoticeModule from './readyNotice/readyNotice';

jest.mock('./jobEdits/jobEditMarks', () => {
  const actual = jest.requireActual('./jobEdits/jobEditMarks');
  return {
    ...actual,
    clearJobEditMarks: jest.fn(actual.clearJobEditMarks),
  };
});

jest.mock('./readyNotice/readyNotice', () => {
  const actual = jest.requireActual('./readyNotice/readyNotice');
  return {
    ...actual,
    clearJobEditedNotices: jest.fn(() => Promise.resolve()),
  };
});

// Row 164 (AC-6): Services.logout() clears job edit marks and cancels job edited notices.
describe('Services logout job edits (row 164, AC-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('services.logout() calls clearJobEditMarks and clearJobEditedNotices', async () => {
    services.logout();

    expect(jobEditMarksModule.clearJobEditMarks).toHaveBeenCalledTimes(1);
    expect(readyNoticeModule.clearJobEditedNotices).toHaveBeenCalledTimes(1);
  });
});
