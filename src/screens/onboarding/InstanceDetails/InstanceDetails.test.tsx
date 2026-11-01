import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { InstanceDetails } from './InstanceDetails';
import { OnboardingScreen } from '@app/navigation/onboarding/types';
import i18n from '@app/localization/i18n';
import { client } from '@app/services/Client';

jest.mock('@app/services/Client', () => ({
  client: {
    get: jest.fn(),
    defaults: { baseURL: '' },
  },
}));

describe('InstanceDetails (spec 0013 AC-7: no public sign up in the app)', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  };

  const mockInstance = {
    id: 'test-instance-id',
    details: {
      name: 'Volos Courier Co-op',
      userCount: 12,
      imageUrl: 'https://example.com/logo.png',
      link: 'https://volos.opencourier.org',
      websocketLink: 'wss://volos.opencourier.org',
      termsOfServiceUrl: 'https://example.com/terms',
      privacyPolicyUrl: 'https://example.com/privacy',
    },
    location: {
      lat: 39.36,
      lon: 22.94,
    },
  };

  const mockRoute: any = {
    params: {
      instanceLink: 'https://volos.opencourier.org',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (client.get as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/metadata')) {
        return Promise.resolve({ data: { result: mockInstance } });
      }
      if (url.endsWith('/description')) {
        return Promise.resolve({
          data: { result: { descriptionContent: 'Co-op description' } },
        });
      }
      if (url.endsWith('/rules')) {
        return Promise.resolve({
          data: { result: { rulesContent: 'Co-op rules' } },
        });
      }
      return Promise.resolve({ data: { result: {} } });
    });
  });

  it('renders a Log in button and no Join button (no text from translations:join_instance)', async () => {
    render(<InstanceDetails navigation={mockNavigation} route={mockRoute} />);

    // Wait until metadata has loaded and instance name is visible
    await waitFor(() => {
      expect(screen.getByText('Volos Courier Co-op')).toBeTruthy();
    });

    // AC-7: Log in is the action button to proceed to login
    const loginButton = screen.getByText(
      i18n.t('translations:login_to_instance'),
    );
    expect(loginButton).toBeTruthy();

    // AC-7: No Join button exists (the co-op issues every rider's login from admin)
    expect(screen.queryByText(i18n.t('translations:join_instance'))).toBeNull();
    expect(screen.queryByText(/join/i)).toBeNull();

    // Pressing Log in navigates to LoginInstance with the loaded instance
    fireEvent.press(loginButton);
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      OnboardingScreen.LoginInstance,
      { instance: mockInstance },
    );
  });

  it('shows error state and retries fetching metadata when request fails', async () => {
    (client.get as jest.Mock).mockRejectedValueOnce(
      new Error('Network error'),
    );

    render(<InstanceDetails navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t('translations:something_went_wrong')),
      ).toBeTruthy();
    });

    // Join button is not rendered during error
    expect(screen.queryByText(i18n.t('translations:join_instance'))).toBeNull();

    // Retry button refetches
    const retryButton = screen.getByText('Retry');
    fireEvent.press(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Volos Courier Co-op')).toBeTruthy();
    });
    expect(
      screen.getByText(i18n.t('translations:login_to_instance')),
    ).toBeTruthy();
  });

  it('navigates back when back button is pressed', async () => {
    render(<InstanceDetails navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('Volos Courier Co-op')).toBeTruthy();
    });

    const backButton = screen.getByTestId(
      'phosphor-react-native-arrow-left-bold',
    );
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});
