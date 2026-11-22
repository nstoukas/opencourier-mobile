import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from 'i18next';
import { Account } from './Account';
import { MainScreens } from '@app/navigation/main/types';
import { BackNavButton } from '@app/components/BackNavButton/BackNavButton';

describe('Account screen (row 84, decision 84.7)', () => {
  const mockNavigation: any = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, back button, and the three account rows', () => {
    render(<Account navigation={mockNavigation} route={{} as any} />);

    expect(screen.getByText(i18n.t('translations:account'))).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:change_password')),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t('translations:account_changes')),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('translations:licenses'))).toBeTruthy();
  });

  it('navigates back when back button pressed', () => {
    render(<Account navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.UNSAFE_getByType(BackNavButton));
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to ChangePassword screen on press', () => {
    render(<Account navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:change_password')));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.ChangePassword,
    );
  });

  it('navigates to AccountChanges screen on press', () => {
    render(<Account navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:account_changes')));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      MainScreens.AccountChanges,
    );
  });

  it('navigates to Licences screen on press', () => {
    render(<Account navigation={mockNavigation} route={{} as any} />);

    fireEvent.press(screen.getByText(i18n.t('translations:licenses')));
    expect(mockNavigation.navigate).toHaveBeenCalledWith(MainScreens.Licences);
  });
});
