import React from 'react';
import { Platform } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

// The edges a screen keeps clear of the system bars (row 104). React Native's
// own SafeAreaView pads every edge on iOS but nothing at all on Android, so on
// Android a screen's title slid under the status bar. This one pads the same
// edges on iOS, and the top and sides on Android. The bottom is left to each
// screen on Android, as before: the ones that need it (Report Issue) already
// pad it themselves.
const EDGES: Edge[] =
  Platform.OS === 'ios'
    ? ['top', 'right', 'bottom', 'left']
    : ['top', 'right', 'left'];

// `React.ComponentProps<typeof SafeAreaView>` is "whatever props SafeAreaView
// takes", so a screen passes `style` and children exactly as before.
export const ScreenSafeArea = (
  props: React.ComponentProps<typeof SafeAreaView>,
) => <SafeAreaView edges={EDGES} {...props} />;
