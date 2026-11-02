import { act, renderHook } from '@testing-library/react-native';
import {
  getOwnPosition,
  setOwnPosition,
  useOwnPosition,
} from './ownPosition';

describe('ownPosition service (spec 0018, AC-5)', () => {
  afterEach(() => {
    setOwnPosition(null);
  });

  it('sets and gets the own position, and clears with null', () => {
    expect(getOwnPosition()).toBeNull();

    setOwnPosition({ latitude: 39.3622, longitude: 22.9425 });
    expect(getOwnPosition()).toEqual({ latitude: 39.3622, longitude: 22.9425 });

    setOwnPosition(null);
    expect(getOwnPosition()).toBeNull();
  });

  it('notifies useOwnPosition subscribers when the position changes', () => {
    const { result, unmount } = renderHook(() => useOwnPosition());

    expect(result.current).toBeNull();

    act(() => {
      setOwnPosition({ latitude: 39.365, longitude: 22.948 });
    });

    expect(result.current).toEqual({ latitude: 39.365, longitude: 22.948 });

    act(() => {
      setOwnPosition(null);
    });

    expect(result.current).toBeNull();

    unmount();
    // After unmount, setting position does not throw
    expect(() => {
      setOwnPosition({ latitude: 39.37, longitude: 22.95 });
    }).not.toThrow();
  });
});
