import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as ringCheck from '@app/services/ringCheck';
import { useRingCheck } from './useRingCheck';

const mockNavigation: any = {
  addListener: jest.fn(),
  isFocused: jest.fn(() => true),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

describe('useRingCheck (row 84, decision 84.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs checkPhoneRings on mount and provides items', async () => {
    const mockItems: ringCheck.RingCheckItem[] = [
      { id: 'notifications', problem: null },
      { id: 'sound', problem: 'phone_silent' },
    ];
    jest.spyOn(ringCheck, 'checkPhoneRings').mockResolvedValueOnce(mockItems);

    const { result } = renderHook(() => useRingCheck());

    expect(result.current.items).toBeNull();

    await waitFor(() => {
      expect(result.current.items).toEqual(mockItems);
    });
  });

  it('subscribes to navigation focus event and re-checks on focus', async () => {
    let focusCallback: () => void = () => {};
    mockNavigation.addListener.mockImplementation((event: string, cb: any) => {
      if (event === 'focus') {
        focusCallback = cb;
      }
      return jest.fn();
    });

    const checkSpy = jest
      .spyOn(ringCheck, 'checkPhoneRings')
      .mockResolvedValue([]);

    renderHook(() => useRingCheck());

    expect(checkSpy).toHaveBeenCalledTimes(1);

    // Trigger focus
    await act(async () => {
      focusCallback();
    });

    expect(checkSpy).toHaveBeenCalledTimes(2);
  });

  it('re-checks when AppState becomes active and screen is focused', async () => {
    let appStateCallback: (state: string) => void = () => {};
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: any, cb: any) => {
        if (event === 'change') {
          appStateCallback = cb;
        }
        return { remove: jest.fn() } as any;
      });

    const checkSpy = jest
      .spyOn(ringCheck, 'checkPhoneRings')
      .mockResolvedValue([]);

    renderHook(() => useRingCheck());

    expect(checkSpy).toHaveBeenCalledTimes(1);

    // AppState active while focused
    mockNavigation.isFocused.mockReturnValue(true);
    await act(async () => {
      appStateCallback('active');
    });
    expect(checkSpy).toHaveBeenCalledTimes(2);

    // AppState active while NOT focused -> does not recheck
    mockNavigation.isFocused.mockReturnValue(false);
    await act(async () => {
      appStateCallback('active');
    });
    expect(checkSpy).toHaveBeenCalledTimes(2);
  });

  it('ignores older check result if newer check was triggered (race condition guard)', async () => {
    let resolveFirst: (items: any) => void = () => {};
    const firstPromise = new Promise(resolve => {
      resolveFirst = resolve;
    });

    const secondItems: ringCheck.RingCheckItem[] = [
      { id: 'notifications', problem: null },
    ];

    jest
      .spyOn(ringCheck, 'checkPhoneRings')
      .mockReturnValueOnce(firstPromise as any)
      .mockResolvedValueOnce(secondItems);

    const { result } = renderHook(() => useRingCheck());

    // Trigger second check before first resolves
    act(() => {
      result.current.recheck();
    });

    // Wait for second check to resolve
    await waitFor(() => {
      expect(result.current.items).toEqual(secondItems);
    });

    // Now resolve first check with stale data
    act(() => {
      resolveFirst([{ id: 'notifications', problem: 'notifications_off' }]);
    });

    // Should still have secondItems!
    expect(result.current.items).toEqual(secondItems);
  });

  it('cleans up listeners on unmount', () => {
    const unsubscribeFocus = jest.fn();
    const removeAppState = jest.fn();

    mockNavigation.addListener.mockReturnValue(unsubscribeFocus);
    jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove: removeAppState } as any);

    const { unmount } = renderHook(() => useRingCheck());

    unmount();

    expect(unsubscribeFocus).toHaveBeenCalledTimes(1);
    expect(removeAppState).toHaveBeenCalledTimes(1);
  });
});
