import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import notifee from '@notifee/react-native';
import i18n from 'i18next';
import { OfferSound } from './OfferSound';
import * as phone from '@app/services/offerPush/phone';
import * as offerAlert from '@app/services/offerPush/offerAlert';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';

describe('OfferSound screen (row 84, decision 84.3)', () => {
  const originalPlatform = Platform.OS;
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
  });

  it('renders title, explanation, and action buttons on Android', () => {
    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByText(i18n.t('translations:offer_sound'))).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:offer_sound_explained')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:offer_sound_play')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:offer_sound_volume')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:offer_sound_change')),
    ).toBeTruthy();
  });

  it('navigates back when back button pressed', () => {
    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.UNSAFE_getByType(BackNavButton));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('plays offer sound when phone is not silenced', async () => {
    jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
      ringerMode: 'normal',
      doNotDisturb: false,
    });
    const playSpy = jest
      .spyOn(phone, 'playOfferSound')
      .mockResolvedValueOnce('played');

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:offer_sound_play')));

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByText(i18n.t('translations:offer_sound_silenced')),
    ).toBeNull();
    expect(screen.queryByText(/offer_sound_none/)).toBeNull();
  });

  it('shows silenced message and does not play when phone is on silent, vibrate, or DND', async () => {
    jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
      ringerMode: 'silent',
      doNotDisturb: false,
    });
    const playSpy = jest.spyOn(phone, 'playOfferSound');

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:offer_sound_play')));

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('translations:offer_sound_silenced')),
      ).toBeTruthy();
    });
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('shows no sound message when playOfferSound returns no_sound', async () => {
    jest.spyOn(phone, 'getRingerState').mockResolvedValueOnce({
      ringerMode: 'normal',
      doNotDisturb: false,
    });
    jest.spyOn(phone, 'playOfferSound').mockResolvedValueOnce('no_sound');

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:offer_sound_play')));

    await waitFor(() => {
      expect(
        screen.getByText(
          i18n.t('translations:offer_sound_none', {
            offers: i18n.t('translations:offer_alert_channel'),
          }),
        ),
      ).toBeTruthy();
    });
  });

  it('opens sound settings when volume button pressed on Android', () => {
    const soundSpy = jest
      .spyOn(phone, 'openSoundSettings')
      .mockImplementation();

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(
      screen.getByText(i18n.t('translations:offer_sound_volume')),
    );

    expect(soundSpy).toHaveBeenCalledTimes(1);
  });

  it('opens Linking settings when volume button pressed on iOS', () => {
    (Platform as any).OS = 'ios';
    const linkingSpy = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValueOnce();

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(
      screen.getByText(i18n.t('translations:offer_sound_volume')),
    );

    expect(linkingSpy).toHaveBeenCalledTimes(1);
  });

  it('ensures offer channels and opens notification settings when change sound pressed', async () => {
    const ensureSpy = jest
      .spyOn(offerAlert, 'ensureOfferChannels')
      .mockResolvedValueOnce();

    render(<OfferSound navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(
      screen.getByText(i18n.t('translations:offer_sound_change')),
    );

    await waitFor(() => {
      expect(ensureSpy).toHaveBeenCalledTimes(1);
      expect(notifee.openNotificationSettings).toHaveBeenCalledTimes(1);
    });
  });
});
