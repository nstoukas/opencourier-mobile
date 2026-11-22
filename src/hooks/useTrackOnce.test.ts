import { AppState, AppStateStatus } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { TRACK_FOR_MS, useTrackOnce } from './useTrackOnce';

describe('useTrackOnce (row 125, decisions 125.1-125.5, OR.12)', () => {
  let appStateListeners: Array<(state: AppStateStatus) => void> = [];
  let removeListenerMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListeners = [];
    AppState.currentState = 'active';
    removeListenerMock = jest.fn();

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, listener: any) => {
        if (event === 'change') {
          appStateListeners.push(listener);
        }
        return {
          remove: () => {
            removeListenerMock();
            appStateListeners = appStateListeners.filter(l => l !== listener);
          },
        } as any;
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts tracking on initial render and turns off after TRACK_FOR_MS', () => {
    const { result } = renderHook(() => useTrackOnce('stop-1-todo'));

    // 1. Immediately tracks
    expect(result.current).toBe(true);

    // 2. Advance time past TRACK_FOR_MS
    act(() => {
      jest.advanceTimersByTime(TRACK_FOR_MS);
    });

    // 3. Tracking turns off
    expect(result.current).toBe(false);
  });

  it('restarts tracking for TRACK_FOR_MS when lookKey changes', () => {
    let key = 'stop-1-todo';
    const { result, rerender } = renderHook(() => useTrackOnce(key));

    act(() => {
      jest.advanceTimersByTime(TRACK_FOR_MS);
    });
    expect(result.current).toBe(false);

    // Change lookKey (e.g. stop turns done)
    key = 'stop-1-done';
    rerender({});

    // Tracks again
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TRACK_FOR_MS);
    });
    expect(result.current).toBe(false);
  });

  it('keeps tracking during rapid lookKey changes and stops TRACK_FOR_MS after the last change', () => {
    let key = 'key-1';
    const { result, rerender } = renderHook(() => useTrackOnce(key));

    expect(result.current).toBe(true);

    // Advance 500ms (< 1000ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);

    // Change key at 500ms
    key = 'key-2';
    rerender({});
    expect(result.current).toBe(true);

    // Advance 600ms (1100ms total, but only 600ms since key-2)
    act(() => {
      jest.advanceTimersByTime(600);
    });
    // Still tracking because timer was reset by key-2!
    expect(result.current).toBe(true);

    // Advance remaining 400ms (1000ms since key-2)
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe(false);
  });

  it('stops tracking immediately when app moves to background, and re-tracks briefly when returning to active', () => {
    const { result } = renderHook(() => useTrackOnce('rider'));

    expect(result.current).toBe(true);

    // App goes to background
    AppState.currentState = 'background';
    act(() => {
      appStateListeners.forEach(listener => listener('background'));
    });

    // Tracking stops immediately
    expect(result.current).toBe(false);

    // App returns to active
    AppState.currentState = 'active';
    act(() => {
      appStateListeners.forEach(listener => listener('active'));
    });

    // Re-tracks briefly on return
    expect(result.current).toBe(true);

    act(() => {
      jest.advanceTimersByTime(TRACK_FOR_MS);
    });
    expect(result.current).toBe(false);
  });

  it('unmounting clears timer and removes AppState listener', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useTrackOnce('pickup'));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(removeListenerMock).toHaveBeenCalled();
  });
});
