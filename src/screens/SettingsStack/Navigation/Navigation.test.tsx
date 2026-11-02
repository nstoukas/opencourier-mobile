import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import '@app/localization/i18n';
import i18n from '@app/localization/i18n';
import { NavigationScreen } from './Navigation';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';
import { MapLinkingOptions } from '@app/types/types';
import * as mapPreferences from '@app/services/mapPreferences';
import * as useNavigateToModule from '@app/hooks/useNavigateTo';

describe('Settings NavigationScreen (spec 0018, AC-12)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
  };

  let getNavigationAppSpy: jest.SpyInstance;
  let setNavigationAppSpy: jest.SpyInstance;
  let installedAppsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getNavigationAppSpy = jest
      .spyOn(mapPreferences, 'getNavigationApp')
      .mockResolvedValue(MapLinkingOptions.google);
    setNavigationAppSpy = jest
      .spyOn(mapPreferences, 'setNavigationApp')
      .mockResolvedValue();
    installedAppsSpy = jest
      .spyOn(useNavigateToModule, 'installedNavigationApps')
      .mockResolvedValue([MapLinkingOptions.google, MapLinkingOptions.waze]);
  });

  afterEach(() => {
    getNavigationAppSpy.mockRestore();
    setNavigationAppSpy.mockRestore();
    installedAppsSpy.mockRestore();
  });

  it('lists only installed navigation apps plus "Ask every time", and marks saved app as checked', async () => {
    const { getByTestId, queryByTestId } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await act(async () => {
      await waitFor(() => {
        expect(
          getByTestId(`navigation-app-${MapLinkingOptions.google}`),
        ).toBeTruthy();
      });
    });

    expect(
      getByTestId(`navigation-app-${MapLinkingOptions.waze}`),
    ).toBeTruthy();
    expect(getByTestId('navigation-app-ask')).toBeTruthy();
    // Apple Maps is not installed, so it must not be rendered
    expect(
      queryByTestId(`navigation-app-${MapLinkingOptions.apple}`),
    ).toBeNull();

    // Google is saved, so checked is true
    expect(
      getByTestId(`navigation-app-${MapLinkingOptions.google}`).props
        .accessibilityState,
    ).toEqual({ checked: true });
    expect(
      getByTestId(`navigation-app-${MapLinkingOptions.waze}`).props
        .accessibilityState,
    ).toEqual({ checked: false });
    expect(
      getByTestId('navigation-app-ask').props.accessibilityState,
    ).toEqual({ checked: false });
  });

  it('saves the choice when an app is chosen', async () => {
    const { getByTestId } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await act(async () => {
      await waitFor(() => {
        expect(
          getByTestId(`navigation-app-${MapLinkingOptions.waze}`),
        ).toBeTruthy();
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId(`navigation-app-${MapLinkingOptions.waze}`));
    });
    expect(setNavigationAppSpy).toHaveBeenCalledWith(MapLinkingOptions.waze);

    expect(
      getByTestId(`navigation-app-${MapLinkingOptions.waze}`).props
        .accessibilityState,
    ).toEqual({ checked: true });
  });

  it('saves null when "Ask every time" is chosen', async () => {
    const { getByTestId } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await act(async () => {
      await waitFor(() => {
        expect(getByTestId('navigation-app-ask')).toBeTruthy();
      });
    });

    await act(async () => {
      fireEvent.press(getByTestId('navigation-app-ask'));
    });
    expect(setNavigationAppSpy).toHaveBeenCalledWith(null);

    expect(
      getByTestId('navigation-app-ask').props.accessibilityState,
    ).toEqual({ checked: true });
  });

  it('back button calls navigation.goBack()', async () => {
    const { UNSAFE_getByType, getByTestId } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await waitFor(() => {
      expect(
        getByTestId(`navigation-app-${MapLinkingOptions.google}`),
      ).toBeTruthy();
    });

    const backBtn = UNSAFE_getByType(BackNavButton);
    fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('shows "Ask every time" as checked when saved app is not installed', async () => {
    // Apple Maps is saved, but only Google Maps is installed
    getNavigationAppSpy.mockResolvedValue(MapLinkingOptions.apple);
    installedAppsSpy.mockResolvedValue([MapLinkingOptions.google]);

    const { getByTestId } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await waitFor(() => {
      expect(
        getByTestId(`navigation-app-${MapLinkingOptions.google}`),
      ).toBeTruthy();
    });

    // Google Maps is not selected
    expect(
      getByTestId(`navigation-app-${MapLinkingOptions.google}`).props
        .accessibilityState,
    ).toEqual({ checked: false });

    // "Ask every time" is checked
    expect(
      getByTestId('navigation-app-ask').props.accessibilityState,
    ).toEqual({ checked: true });
  });

  it('shows "No navigation app found on this phone. Install Google Maps or Waze." when no app is installed', async () => {
    installedAppsSpy.mockResolvedValue([]);
    getNavigationAppSpy.mockResolvedValue(null);

    const { getByTestId, getByText } = render(
      <NavigationScreen navigation={mockNavigation} route={{} as any} />,
    );

    await waitFor(() => {
      expect(getByTestId('navigation-app-ask')).toBeTruthy();
    });

    expect(getByTestId('navigation-app-none')).toBeTruthy();
    expect(
      getByText(
        'No navigation app found on this phone. Install Google Maps or Waze.',
      ),
    ).toBeTruthy();
    expect(
      getByTestId('navigation-app-ask').props.accessibilityState,
    ).toEqual({ checked: true });
  });
});
