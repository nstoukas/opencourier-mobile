import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '@app/localization/i18n';
import {
  addSosPoint,
  endSos,
  loadSosRecord,
  markSosStarted,
  resetSosStoreForTests,
  startSos,
} from '@app/services/sosStore';
import * as sosSenderModule from '@app/services/sosSender';
import { SosScreen } from './SosScreen';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNav = {
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNav,
  };
});

let mockLocationPermission = true;
jest.mock('@app/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    locationPermission: mockLocationPermission,
  }),
}));

const mockUser = { id: 'rider-1', name: 'Rider One' };
jest.mock('@app/hooks/useUser', () => () => ({
  user: mockUser,
}));

describe('SosScreen (spec 0022, AC-3, AC-6)', () => {
  let alertSpy: jest.SpyInstance;
  let openURLSpy: jest.SpyInstance;

  beforeEach(async () => {
    resetSosStoreForTests();
    sosSenderModule.resetSosSenderForTests();
    await AsyncStorage.clear();
    jest.clearAllMocks();

    mockLocationPermission = true;
    mockCanGoBack.mockReturnValue(true);

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    openURLSpy.mockRestore();
  });

  it('shows "Alerting the co-op…" while record has no incidentId, and "The co-op has been alerted" once it has', async () => {
    await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

    const { getByTestId, rerender } = render(<SosScreen />);

    expect(getByTestId('sos-status').props.children).toBe(
      'Alerting the co-op…',
    );

    // Server gets the incident
    await act(async () => {
      await markSosStarted('rider-1', 'c1', 'inc-123');
    });

    rerender(<SosScreen />);
    expect(getByTestId('sos-status').props.children).toBe(
      'The co-op has been alerted',
    );
  });

  describe('no signal indicator', () => {
    it('shows "No signal: your position is saved and will be sent" only when outcome was noSignal and something waits', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });
      // Case 1: no incidentId yet, and outcome is noSignal -> waits for incidentId
      jest
        .spyOn(sosSenderModule, 'getLastSosOutcome')
        .mockReturnValue('noSignal');

      const { getByTestId, queryByTestId, rerender } = render(<SosScreen />);
      expect(getByTestId('sos-no-signal')).toBeTruthy();
      expect(getByTestId('sos-no-signal').props.children).toBe(
        'No signal: your position is saved and will be sent',
      );

      // Case 2: incidentId received, but points waiting -> still shows
      await act(async () => {
        await markSosStarted('rider-1', 'c1', 'inc-123');
        await addSosPoint('rider-1', {
          latitude: 39,
          longitude: 22,
          takenAt: 1500,
        });
      });
      rerender(<SosScreen />);
      expect(getByTestId('sos-no-signal')).toBeTruthy();

      // Case 3: incidentId received, 0 points waiting, but outcome is noSignal -> does NOT show (nothing waits)
      await act(async () => {
        // Drop all points
        await sosSenderModule.sendSos(
          'rider-1',
          {
            start: jest.fn(),
            getActive: jest.fn(),
            sendPoints: jest.fn().mockResolvedValue({
              kind: 'ok',
              result: { accepted: 1 },
            }),
            end: jest.fn(),
          },
          () => 'rider-1',
        );
      });
      // Mock outcome back to noSignal with 0 points
      jest
        .spyOn(sosSenderModule, 'getLastSosOutcome')
        .mockReturnValue('noSignal');
      rerender(<SosScreen />);
      expect(queryByTestId('sos-no-signal')).toBeNull();

      // Case 4: outcome is idle or retry -> does NOT show
      jest.spyOn(sosSenderModule, 'getLastSosOutcome').mockReturnValue('idle');
      rerender(<SosScreen />);
      expect(queryByTestId('sos-no-signal')).toBeNull();
    });
  });

  describe('location permission status note', () => {
    it('shows location off note when locationPermission is false', async () => {
      mockLocationPermission = false;
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { getByText } = render(<SosScreen />);
      expect(
        getByText(
          'Location is off for this app, so your position is not shared.',
        ),
      ).toBeTruthy();
    });

    it('shows sharing note when locationPermission is true', async () => {
      mockLocationPermission = true;
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { getByText } = render(<SosScreen />);
      expect(
        getByText(
          'Your position is shared with the co-op until you end this SOS.',
        ),
      ).toBeTruthy();
    });
  });

  describe('Call 112 action', () => {
    it('opens tel:112 when Call 112 is pressed', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { getByText } = render(<SosScreen />);
      fireEvent.press(getByText('Call 112'));

      expect(openURLSpy).toHaveBeenCalledWith('tel:112');
    });
  });

  describe("I'm safe and False alarm confirmation prompts (AC-6)", () => {
    it('"I\'m safe" asks once and confirming writes safe end', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { getByText } = render(<SosScreen />);
      fireEvent.press(getByText("I'm safe"));

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, body, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe("You're safe?");
      expect(body).toBe(
        'Sharing your position stops now. The co-op sees that you are safe.',
      );

      // Cancel button does nothing
      const cancelBtn = buttons.find((b: any) => b.text === 'Cancel');
      cancelBtn.onPress?.();
      let record = await loadSosRecord('rider-1');
      expect(record?.end).toBeUndefined();

      // Confirm button writes safe end
      const confirmBtn = buttons.find((b: any) => b.text === 'Yes, end SOS');
      await act(async () => {
        confirmBtn.onPress?.();
      });

      record = await loadSosRecord('rider-1');
      expect(record?.end?.kind).toBe('safe');
    });

    it('"False alarm" asks once and confirming writes falseAlarm end', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { getByText } = render(<SosScreen />);
      fireEvent.press(getByText('False alarm'));

      expect(alertSpy).toHaveBeenCalledTimes(1);
      const [title, body, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('False alarm?');
      expect(body).toBe(
        'Sharing your position stops now. The co-op sees it was a false alarm.',
      );

      const confirmBtn = buttons.find((b: any) => b.text === 'Yes, end SOS');
      await act(async () => {
        confirmBtn.onPress?.();
      });

      const record = await loadSosRecord('rider-1');
      expect(record?.end?.kind).toBe('falseAlarm');
    });
  });

  describe('navigation dismissal behavior', () => {
    it('does not call goBack on initial render when no record is loaded yet', () => {
      render(<SosScreen />);
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('calls goBack once a record it saw shared stops being shared', async () => {
      await startSos('rider-1', { clientId: 'c1', heldAt: 1000 });

      const { rerender } = render(<SosScreen />);
      // Initially sharing: does not call goBack
      expect(mockGoBack).not.toHaveBeenCalled();

      // Rider ends the SOS
      await act(async () => {
        await endSos('rider-1', { kind: 'safe', tappedAt: 2000 });
      });

      rerender(<SosScreen />);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
