import {
  clearPickedUpTimes,
  getPickedUpAt,
  setPickedUpAt,
} from './pickupTimes';

describe('pickupTimes service (spec 0021, review fix)', () => {
  beforeEach(() => {
    clearPickedUpTimes();
  });

  afterEach(() => {
    clearPickedUpTimes();
  });

  it('stores and retrieves the swipe time for a delivery', () => {
    expect(getPickedUpAt('del-1')).toBeUndefined();

    setPickedUpAt('del-1', 1700000000000);
    expect(getPickedUpAt('del-1')).toBe(1700000000000);

    setPickedUpAt('del-2', 1700000050000);
    expect(getPickedUpAt('del-2')).toBe(1700000050000);
    expect(getPickedUpAt('del-1')).toBe(1700000000000);
  });

  it('clears all recorded times on clearPickedUpTimes', () => {
    setPickedUpAt('del-1', 1700000000000);
    setPickedUpAt('del-2', 1700000050000);

    clearPickedUpTimes();

    expect(getPickedUpAt('del-1')).toBeUndefined();
    expect(getPickedUpAt('del-2')).toBeUndefined();
  });
});
