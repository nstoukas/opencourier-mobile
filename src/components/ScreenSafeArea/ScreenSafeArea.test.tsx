// Row 104 / decision 104.2: ScreenSafeArea keeps a screen's title and back button clear of the
// status bar. It wraps react-native-safe-area-context's SafeAreaView (React Native's own pads
// nothing on Android) and picks its edges from Platform.OS when the module loads, so each case
// below loads a fresh copy of every module after setting the platform.

type Loaded = {
  React: typeof import('react');
  renderer: typeof import('react-test-renderer');
  RN: typeof import('react-native');
  safeArea: typeof import('react-native-safe-area-context');
  ScreenSafeArea: typeof import('./ScreenSafeArea').ScreenSafeArea;
};

// Renders an element with this platform's renderer and returns the tree's root.
function renderFor(l: Loaded, element: React.ReactElement) {
  let tree: import('react-test-renderer').ReactTestRenderer | undefined;
  l.renderer.act(() => {
    tree = l.renderer.create(element);
  });
  if (!tree) {
    throw new Error('nothing rendered');
  }
  return tree.root;
}

// Fresh modules for one platform. React, the renderer and the component all come from the same
// registry, or rendering would mix two copies of React.
function loadFor(os: 'ios' | 'android'): Loaded {
  let loaded: Loaded | undefined;
  jest.isolateModules(() => {
    const RN = require('react-native') as typeof import('react-native');
    // Platform.OS is a plain property in the Jest build of React Native (default 'ios').
    (RN.Platform as { OS: string }).OS = os;
    loaded = {
      React: require('react'),
      // react-test-renderer, not Testing Library: Testing Library registers Jest hooks when it
      // is first required, which Jest refuses inside a test.
      renderer: require('react-test-renderer'),
      RN,
      safeArea: require('react-native-safe-area-context'),
      ScreenSafeArea: require('./ScreenSafeArea').ScreenSafeArea,
    };
  });
  if (!loaded) {
    throw new Error('modules did not load');
  }
  return loaded;
}

// The element ScreenSafeArea returns, without rendering: its type and the props it hands on.
function elementFor(
  l: Loaded,
  props: Record<string, unknown> = {},
): { type: unknown; props: Record<string, unknown> } {
  const el = (l.ScreenSafeArea as unknown as (p: object) => unknown)(props);
  return el as { type: unknown; props: Record<string, unknown> };
}

const sorted = (edges: unknown) => [...(edges as string[])].sort();

describe('ScreenSafeArea (row 104)', () => {
  describe('on Android', () => {
    it('wraps safe-area-context SafeAreaView, not React Native SafeAreaView', () => {
      const l = loadFor('android');
      const el = elementFor(l);
      expect(el.type).toBe(l.safeArea.SafeAreaView);
      expect(el.type).not.toBe(l.RN.SafeAreaView);
    });

    it('keeps the top and both sides clear, and leaves the bottom to each screen', () => {
      const l = loadFor('android');
      const edges = elementFor(l).props.edges;
      expect(sorted(edges)).toEqual(['left', 'right', 'top']);
      expect(edges).not.toContain('bottom');
    });

    it('tells the native view top is padded and bottom is off', () => {
      const l = loadFor('android');
      const root = renderFor(
        l,
        l.React.createElement(l.ScreenSafeArea, { testID: 'safe' }),
      );
      // The host element safe-area-context renders carries the edges as a record.
      const host = root.findAll(
        n => typeof n.type === 'string' && n.props.testID === 'safe',
      )[0];
      expect(host.props.edges).toEqual({
        top: 'additive',
        right: 'additive',
        bottom: 'off',
        left: 'additive',
      });
    });
  });

  describe('on iOS', () => {
    it('keeps all four edges clear, as React Native SafeAreaView did', () => {
      const l = loadFor('ios');
      const el = elementFor(l);
      expect(el.type).toBe(l.safeArea.SafeAreaView);
      expect(sorted(el.props.edges)).toEqual([
        'bottom',
        'left',
        'right',
        'top',
      ]);
    });
  });

  it.each(['ios', 'android'] as const)(
    'passes style and children through on %s',
    os => {
      const l = loadFor(os);
      const { React, RN, ScreenSafeArea } = l;
      const style = { flex: 1, backgroundColor: 'red' };
      const root = renderFor(
        l,
        React.createElement(
          ScreenSafeArea,
          { style, testID: 'safe' },
          React.createElement(RN.Text, { testID: 'child' }, 'Payment methods'),
        ),
      );
      const hosts = (id: string) =>
        root.findAll(n => typeof n.type === 'string' && n.props.testID === id);
      expect(hosts('child')).toHaveLength(1);
      expect(hosts('child')[0].props.children).toBe('Payment methods');
      const safe = hosts('safe');
      expect(safe).toHaveLength(1);
      expect(RN.StyleSheet.flatten(safe[0].props.style)).toEqual(
        expect.objectContaining(style),
      );
    },
  );
});
