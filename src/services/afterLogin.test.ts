import { markJustLoggedIn, takeJustLoggedIn } from './afterLogin';

describe('afterLogin in-memory flag (spec 0039, AC-15)', () => {
  beforeEach(() => {
    // Clear flag before each test
    takeJustLoggedIn();
  });

  it('returns false by default when no login or reset occurred', () => {
    expect(takeJustLoggedIn()).toBe(false);
  });

  it('returns true once after markJustLoggedIn and false on the next call', () => {
    markJustLoggedIn();
    expect(takeJustLoggedIn()).toBe(true);
    expect(takeJustLoggedIn()).toBe(false);
  });
});
