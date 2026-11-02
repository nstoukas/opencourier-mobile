import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import '@app/localization/i18n';
import { HomeCard, HomeCardMode } from './HomeCard';
import i18n from '@app/localization/i18n';

describe('HomeCard (spec 0018, AC-8)', () => {
  const defaultProps = {
    isLoading: false,
    onGoOnline: jest.fn(),
    onLastCall: jest.fn(),
    onStayOnline: jest.fn(),
    onGoOffline: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('card modes', () => {
    it('renders Offline mode with Go Online swipe', () => {
      const { getByTestId, getByText } = render(
        <HomeCard {...defaultProps} mode={HomeCardMode.Offline} />,
      );

      expect(getByTestId('home-card-offline')).toBeTruthy();
      expect(getByText(i18n.t('translations:go_online'))).toBeTruthy();
    });

    it('renders Online mode with "Waiting for offers", Last call button, and Go offline button', () => {
      const { getByTestId, getByText } = render(
        <HomeCard {...defaultProps} mode={HomeCardMode.Online} />,
      );

      expect(getByTestId('home-card-online')).toBeTruthy();
      expect(getByTestId('home-card-waiting')).toBeTruthy();
      expect(getByText(i18n.t('translations:waiting_for_offers'))).toBeTruthy();

      const lastCallBtn = getByText(i18n.t('translations:last_call_button'));
      const goOfflineBtn = getByText(i18n.t('translations:go_offline'));

      fireEvent.press(lastCallBtn);
      expect(defaultProps.onLastCall).toHaveBeenCalledTimes(1);

      fireEvent.press(goOfflineBtn);
      expect(defaultProps.onGoOffline).toHaveBeenCalledTimes(1);
    });

    it('renders LastCall mode with explanation sentence, Stay online button, and Go offline button', () => {
      const { getByTestId, getByText } = render(
        <HomeCard {...defaultProps} mode={HomeCardMode.LastCall} />,
      );

      expect(getByTestId('home-card-last_call')).toBeTruthy();
      expect(getByTestId('home-card-last-call')).toBeTruthy();
      expect(getByText(i18n.t('translations:last_call_explained'))).toBeTruthy();

      const stayOnlineBtn = getByText(i18n.t('translations:stay_online'));
      const goOfflineBtn = getByText(i18n.t('translations:go_offline'));

      fireEvent.press(stayOnlineBtn);
      expect(defaultProps.onStayOnline).toHaveBeenCalledTimes(1);

      fireEvent.press(goOfflineBtn);
      expect(defaultProps.onGoOffline).toHaveBeenCalledTimes(1);
    });

    it('renders Offer mode with children in scroll view', () => {
      const { getByTestId, getByText } = render(
        <HomeCard {...defaultProps} mode={HomeCardMode.Offer}>
          <Text>Offer Cell Content</Text>
        </HomeCard>,
      );

      expect(getByTestId('home-card-offer')).toBeTruthy();
      expect(getByText('Offer Cell Content')).toBeTruthy();
    });

    it('renders Job mode with children in scroll view', () => {
      const { getByTestId, getByText } = render(
        <HomeCard {...defaultProps} mode={HomeCardMode.Job}>
          <Text>Job Cell Content</Text>
        </HomeCard>,
      );

      expect(getByTestId('home-card-job')).toBeTruthy();
      expect(getByText('Job Cell Content')).toBeTruthy();
    });
  });

  describe('pager (1 of N)', () => {
    it('renders pager when count > 1 and handles previous and next presses', () => {
      const onPreviousMock = jest.fn();
      const onNextMock = jest.fn();

      const { getByTestId, getByText } = render(
        <HomeCard
          {...defaultProps}
          mode={HomeCardMode.Job}
          pager={{
            index: 0,
            count: 2,
            onPrevious: onPreviousMock,
            onNext: onNextMock,
          }}>
          <Text>Job 1</Text>
        </HomeCard>,
      );

      expect(getByTestId('home-card-pager')).toBeTruthy();
      expect(
        getByText(
          i18n.t('translations:card_position', { position: 1, count: 2 }),
        ),
      ).toBeTruthy();

      fireEvent.press(getByTestId('home-card-previous'));
      expect(onPreviousMock).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('home-card-next'));
      expect(onNextMock).toHaveBeenCalledTimes(1);
    });

    it('does not render pager when count <= 1', () => {
      const { queryByTestId } = render(
        <HomeCard
          {...defaultProps}
          mode={HomeCardMode.Job}
          pager={{
            index: 0,
            count: 1,
            onPrevious: jest.fn(),
            onNext: jest.fn(),
          }}>
          <Text>Job 1</Text>
        </HomeCard>,
      );

      expect(queryByTestId('home-card-pager')).toBeNull();
      expect(queryByTestId('home-card-previous')).toBeNull();
      expect(queryByTestId('home-card-next')).toBeNull();
    });
  });
});
