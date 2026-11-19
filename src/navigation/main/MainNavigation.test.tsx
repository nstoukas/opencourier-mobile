import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';
import { MainStack } from './MainNavigation';
import { markJustLoggedIn, takeJustLoggedIn } from '@app/services/afterLogin';

jest.mock('../drawer/DrawerNavigation', () => {
  const { View } = require('react-native');
  return {
    DrawerStack: () => <View testID="mock-drawer-stack" />,
  };
});

jest.mock('@app/screens/Permissions/Permissions', () => {
  const { View } = require('react-native');
  return {
    Permissions: () => <View testID="mock-permissions-screen" />,
  };
});

describe('MainNavigation initial route decision (spec 0039, AC-15)', () => {
  beforeEach(() => {
    // Clear the in-memory flag
    takeJustLoggedIn();
  });

  it('on an app restart while logged in (no in-memory flag), Permissions is not shown and Drawer is initial route', () => {
    render(
      <NavigationContainer>
        <MainStack />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('mock-drawer-stack')).toBeTruthy();
    expect(screen.queryByTestId('mock-permissions-screen')).toBeNull();
  });

  it('after a login or reset (in-memory flag set), Permissions is the first screen', () => {
    markJustLoggedIn();

    render(
      <NavigationContainer>
        <MainStack />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('mock-permissions-screen')).toBeTruthy();
  });
});
