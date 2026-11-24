import { renderHook, act } from '@testing-library/react-native';
import {
  LOCATION_OFF_ERROR_CODES,
  LOCATION_OFF_RETRY_MS,
  getLocationOff,
  setLocationOff,
  useLocationOff,
} from './locationOff';

describe('locationOff store (Row 156, Clause 5)', () => {
  beforeEach(() => {
    setLocationOff(false);
  });

  it('starts with locationOff as false', () => {
    expect(getLocationOff()).toBe(false);
  });

  it('sets and gets the locationOff flag in memory', () => {
    setLocationOff(true);
    expect(getLocationOff()).toBe(true);

    setLocationOff(false);
    expect(getLocationOff()).toBe(false);
  });

  it('notifies useLocationOff hook subscribers on change', () => {
    const { result } = renderHook(() => useLocationOff());
    expect(result.current).toBe(false);

    act(() => {
      setLocationOff(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      setLocationOff(false);
    });
    expect(result.current).toBe(false);
  });

  it('does not re-notify if setLocationOff is called with the identical value', () => {
    const { result } = renderHook(() => useLocationOff());
    expect(result.current).toBe(false);

    // Setting same value (false) should be a no-op
    act(() => {
      setLocationOff(false);
    });
    expect(result.current).toBe(false);
  });

  it('defines LOCATION_OFF_ERROR_CODES containing 2 and 5, excluding 3 (Clause 4)', () => {
    // 2 = POSITION_UNAVAILABLE (location off), 5 = SETTINGS_NOT_SATISFIED
    expect(LOCATION_OFF_ERROR_CODES).toContain(2);
    expect(LOCATION_OFF_ERROR_CODES).toContain(5);
    // 3 = TIMEOUT (weak signal indoors), never a location off setting
    expect(LOCATION_OFF_ERROR_CODES).not.toContain(3);
    expect(LOCATION_OFF_ERROR_CODES).not.toContain(1);
  });

  it('defines LOCATION_OFF_RETRY_MS as 30 seconds (Row 156 review)', () => {
    expect(LOCATION_OFF_RETRY_MS).toBe(30_000);
  });
});
