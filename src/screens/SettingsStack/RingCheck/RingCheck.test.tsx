import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from 'i18next';
import { RingCheck } from './RingCheck';
import * as useRingCheckModule from '@app/hooks/useRingCheck';
import * as ringCheckService from '@app/services/ringCheck';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';

describe('RingCheck screen (row 84, decision 84.4, 84.5)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders checking summary when items is null', () => {
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: null,
      recheck: jest.fn(),
    });

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    expect(
      screen.getByText(i18n.t('translations:ring_check_checking')),
    ).toBeTruthy();
  });

  it('renders all good summary when all checks are healthy', () => {
    const mockItems: ringCheckService.RingCheckItem[] = [
      { id: 'notifications', problem: null },
      { id: 'offer_alerts', problem: null },
      { id: 'full_screen', problem: null },
      { id: 'sound', problem: null },
      { id: 'battery', problem: null },
    ];
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: mockItems,
      recheck: jest.fn(),
    });

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    expect(
      screen.getByText(i18n.t('translations:ring_check_all_good')),
    ).toBeTruthy();

    // Check OK text is displayed
    const okLabels = screen.getAllByText(i18n.t('translations:ring_check_ok'));
    expect(okLabels.length).toBe(5);
  });

  it('renders needs fixing summary and displays problem text with Open Settings button', () => {
    const mockItems: ringCheckService.RingCheckItem[] = [
      { id: 'notifications', problem: 'notifications_off' },
      { id: 'sound', problem: 'phone_silent' },
    ];
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: mockItems,
      recheck: jest.fn(),
    });
    const openFixSpy = jest
      .spyOn(ringCheckService, 'openFixFor')
      .mockResolvedValue();

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    expect(
      screen.getByText(i18n.t('translations:ring_check_needs_fixing')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:ring_problem_notifications_off')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:ring_problem_phone_silent')),
    ).toBeTruthy();

    const openSettingsButtons = screen.getAllByText(
      i18n.t('translations:open_settings'),
    );
    expect(openSettingsButtons.length).toBe(2);

    // Pressing first button opens fix for notifications_off
    fireEvent.press(openSettingsButtons[0]);
    expect(openFixSpy).toHaveBeenCalledWith('notifications_off');

    // Pressing second button opens fix for phone_silent
    fireEvent.press(openSettingsButtons[1]);
    expect(openFixSpy).toHaveBeenCalledWith('phone_silent');
  });

  it('presses every problem button across all check categories and asserts each opens its own setting', () => {
    const allProblemItems: ringCheckService.RingCheckItem[] = [
      { id: 'notifications', problem: 'notifications_off' },
      { id: 'offer_alerts', problem: 'offer_alerts_off' },
      { id: 'full_screen', problem: 'full_screen_off' },
      { id: 'sound', problem: 'phone_silent' },
      { id: 'battery', problem: 'battery_optimised' },
    ];
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: allProblemItems,
      recheck: jest.fn(),
    });
    const openFixSpy = jest
      .spyOn(ringCheckService, 'openFixFor')
      .mockResolvedValue();

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    const openSettingsButtons = screen.getAllByText(
      i18n.t('translations:open_settings'),
    );
    expect(openSettingsButtons.length).toBe(5);

    // Press each problem's button and assert each opens its own setting
    allProblemItems.forEach((item, index) => {
      fireEvent.press(openSettingsButtons[index]);
      expect(openFixSpy).toHaveBeenNthCalledWith(index + 1, item.problem);
    });
  });

  it('tapping check again calls recheck', () => {
    const recheckMock = jest.fn();
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: [],
      recheck: recheckMock,
    });

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:ring_check_again')));
    expect(recheckMock).toHaveBeenCalledTimes(1);
  });

  it('tapping back button goes back', () => {
    jest.spyOn(useRingCheckModule, 'useRingCheck').mockReturnValue({
      items: [],
      recheck: jest.fn(),
    });

    render(<RingCheck navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.UNSAFE_getByType(BackNavButton));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});
