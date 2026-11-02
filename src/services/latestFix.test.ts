import { renderHook, act } from '@testing-library/react-native';
import { Fix, getLatestFix, setLatestFix, useLatestFix } from './latestFix';

describe('latestFix store (spec 0021, AC-1, AC-13)', () => {
  beforeEach(() => {
    setLatestFix(null);
  });

  it('stores and retrieves the latest fix in memory', () => {
    expect(getLatestFix()).toBeNull();

    const sampleFix: Fix = {
      latitude: 39.362,
      longitude: 22.945,
      accuracyMetres: 12.5,
      at: 1700000000000,
    };

    setLatestFix(sampleFix);
    expect(getLatestFix()).toEqual(sampleFix);

    setLatestFix(null);
    expect(getLatestFix()).toBeNull();
  });

  it('notifies subscribers and updates useLatestFix hook on change', () => {
    const { result } = renderHook(() => useLatestFix());

    expect(result.current).toBeNull();

    const fix1: Fix = {
      latitude: 39.362,
      longitude: 22.945,
      accuracyMetres: 8.0,
      at: 1700000001000,
    };

    act(() => {
      setLatestFix(fix1);
    });

    expect(result.current).toEqual(fix1);

    const fix2: Fix = {
      latitude: 39.363,
      longitude: 22.946,
      accuracyMetres: 15.0,
      at: 1700000002000,
    };

    act(() => {
      setLatestFix(fix2);
    });

    expect(result.current).toEqual(fix2);

    act(() => {
      setLatestFix(null);
    });

    expect(result.current).toBeNull();
  });
});
