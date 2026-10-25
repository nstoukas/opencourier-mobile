/* eslint-env jest */
/**
 * Runs once before every test file (wired through `setupFiles` in package.json).
 *
 * Jest runs in Node, not on a phone, so the app's native modules (Firebase, maps, GPS,
 * notifications...) do not exist there and crash on import. Each `jest.mock` below swaps
 * one of them for a stand in. Where a library ships its own Jest mock we use it, because
 * it is kept in step with the library's API; the rest get a minimal hand mock, one object
 * each, with only what the app calls.
 *
 * A test file can still override any of these with its own `jest.mock`.
 */

/* ---------- Mocks the libraries ship themselves ---------- */

// The gesture handler's setup file registers its own native module mocks.
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // The drawer calls isConfigured() to pick its Reanimated 3 code path, and the shipped
  // mock leaves it out ("ADD ME IF NEEDED"), so the drawer would ask for the removed
  // Reanimated 1 API and throw. On a phone the real library answers true.
  const isConfigured = () => true;
  return { ...mock, isConfigured, default: { ...mock.default, isConfigured } };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);

jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-clipboard/clipboard', () =>
  require('@react-native-clipboard/clipboard/jest/clipboard-mock'),
);

/* ---------- Hand mocks (the library ships none) ---------- */

// react-native-restart ships no mock; the side menu calls restart() after an instance switch.
jest.mock('react-native-restart', () => ({
  __esModule: true,
  default: { restart: jest.fn(), Restart: jest.fn() },
}));

// Firebase messaging: index.js and the push hook call these; none should touch a network.
jest.mock('@react-native-firebase/messaging', () => {
  const instance = {
    onMessage: jest.fn(() => jest.fn()),
    setBackgroundMessageHandler: jest.fn(),
    onTokenRefresh: jest.fn(() => jest.fn()),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    hasPermission: jest.fn(() => Promise.resolve(1)),
  };
  const messaging = () => instance;
  messaging.AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return { __esModule: true, default: messaging };
});

// Maps draw with native views; plain Views keep the tree renderable.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = props => React.createElement(View, props);
  const MockMarker = props => React.createElement(View, props);
  const MockPolyline = props => React.createElement(View, props);
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
    PROVIDER_GOOGLE: 'google',
  };
});

// GPS: never reports a position unless a test calls the success callback itself.
jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(() => Promise.resolve('granted')),
  },
}));

// The action sheet opens a native menu (Home's "open in maps" choice).
jest.mock('react-native-action-sheet', () => ({
  __esModule: true,
  default: { showActionSheetWithOptions: jest.fn() },
}));

// The camera is a native view; the photo screen only needs it to render.
jest.mock('react-native-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const RNCamera = props => React.createElement(View, props);
  RNCamera.Constants = {
    Type: { back: 'back', front: 'front' },
    FlashMode: { on: 'on', off: 'off', torch: 'torch', auto: 'auto' },
  };
  return { RNCamera };
});

// The date picker is a native wheel; a View stands in.
jest.mock('react-native-date-picker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: props => React.createElement(View, props),
  };
});

// App.tsx loads Reactotron under __DEV__, which is true in Jest; it would try to connect
// to a desktop debugger.
jest.mock('./ReactotronConfig', () => ({}));
