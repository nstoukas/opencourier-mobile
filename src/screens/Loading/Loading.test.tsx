import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions } from '@react-navigation/native';
import { RootScreen } from '@app/navigation/types';
import { LoadingScreen } from './Loading';

jest.mock('@app/hooks/useUser', () => () => ({
  user: undefined,
  isLoading: false,
}));

describe('LoadingScreen (spec 0039, AC-1, Clause 9)', () => {
  const mockNavigation: any = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('with no saved token, dispatches StackActions.replace(RootScreen.Auth) (not navigate)', async () => {
    render(<LoadingScreen navigation={mockNavigation} route={{} as any} />);

    await waitFor(() => {
      expect(mockNavigation.dispatch).toHaveBeenCalledWith(
        StackActions.replace(RootScreen.Auth),
      );
    });
  });

  it('with a saved token, does not dispatch replace to Auth', async () => {
    await AsyncStorage.setItem('token', 'saved-auth-token');

    render(<LoadingScreen navigation={mockNavigation} route={{} as any} />);

    await waitFor(() => {
      expect(mockNavigation.dispatch).not.toHaveBeenCalled();
    });
  });
});
