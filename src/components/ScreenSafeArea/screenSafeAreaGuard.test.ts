import fs from 'fs';
import path from 'path';

// Row 104 / decision 104.2: React Native's own SafeAreaView pads nothing on Android, so a screen
// wrapped in it draws its title and back button under the status bar. Every screen uses
// ScreenSafeArea instead. This scans the source text, so it fails the moment any file goes back.

const srcDir = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (
      /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

const rel = (file: string) => `src/${path.relative(srcDir, file)}`;

// Named imports from 'react-native' exactly (not 'react-native-safe-area-context'), across lines.
const RN_NAMED_IMPORT =
  /import\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g;
// SafeAreaView read off React Native some other way: require('react-native').SafeAreaView,
// or a destructured require.
const RN_REQUIRE_SAFE_AREA =
  /require\(\s*['"]react-native['"]\s*\)\s*\.\s*SafeAreaView\b|\{[^}]*\bSafeAreaView\b[^}]*\}\s*=\s*require\(\s*['"]react-native['"]\s*\)/;
// A namespace or default import of React Native, e.g. `import * as RN from 'react-native'`.
const RN_NAMESPACE_IMPORT =
  /import\s+(?:\*\s+as\s+)?([\w$]+)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]react-native['"]/g;

function reactNativeSafeAreaUses(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(RN_NAMED_IMPORT)) {
    const names = m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
    if (names.includes('SafeAreaView')) {
      found.push(
        `imports SafeAreaView from 'react-native': ${m[0].replace(
          /\s+/g,
          ' ',
        )}`,
      );
    }
  }
  if (RN_REQUIRE_SAFE_AREA.test(text)) {
    found.push("requires SafeAreaView from 'react-native'");
  }
  for (const m of text.matchAll(RN_NAMESPACE_IMPORT)) {
    if (new RegExp(`\\b${m[1]}\\.SafeAreaView\\b`).test(text)) {
      found.push(`uses ${m[1]}.SafeAreaView`);
    }
  }
  return found;
}

describe('Screen safe area guard (row 104)', () => {
  const files = sourceFiles(srcDir);

  it('scans the app source', () => {
    // A wrong srcDir would make the guard below pass over nothing.
    expect(files.length).toBeGreaterThan(50);
    expect(files.map(rel)).toContain('src/screens/History/History.tsx');
  });

  it("no file under src takes SafeAreaView from 'react-native'", () => {
    const violations = files.flatMap(file =>
      reactNativeSafeAreaUses(fs.readFileSync(file, 'utf-8')).map(
        v => `${rel(file)}: ${v}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  it('only ScreenSafeArea uses a SafeAreaView, and it takes it from safe-area-context', () => {
    const users = files
      .filter(file => /<SafeAreaView\b/.test(fs.readFileSync(file, 'utf-8')))
      .map(rel);
    expect(users).toEqual(['src/components/ScreenSafeArea/ScreenSafeArea.tsx']);
    const wrapper = fs.readFileSync(
      path.join(srcDir, 'components/ScreenSafeArea/ScreenSafeArea.tsx'),
      'utf-8',
    );
    expect(wrapper).toMatch(
      /import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*['"]react-native-safe-area-context['"]/,
    );
  });

  // The 22 screens row 104's commit moved off React Native's SafeAreaView.
  const screens = [
    'screens/Earnings/Earnings.tsx',
    'screens/EarningsDay/EarningsDay.tsx',
    'screens/EarningsDelivery/EarningsDelivery.tsx',
    'screens/History/History.tsx',
    'screens/Licences/Licences.tsx',
    'screens/OfferAlert/OfferAlertScreen.tsx',
    'screens/PaymentMethods/PaymentMethods.tsx',
    'screens/PayoutActivity/PayoutActivity.tsx',
    'screens/ReportIssue/ReportIssue.tsx',
    'screens/Settings/Settings.tsx',
    'screens/SettingsStack/DefaultSound/DefaultSound.tsx',
    'screens/SettingsStack/EmergencyContact/EmergencyContact.tsx',
    'screens/SettingsStack/Language/Language.tsx',
    'screens/SettingsStack/Navigation/Navigation.tsx',
    'screens/SettingsStack/OperatingArea/OperatingArea.tsx',
    'screens/SettingsStack/ShiftAvailability/ShiftAvailabilityScreen.tsx',
    'screens/SettingsStack/VehicleType/VehicleType.tsx',
    'screens/SettingsStack/Volume/Volume.tsx',
    'screens/onboarding/ChooseInstance/ChooseInstance.tsx',
    'screens/onboarding/InstanceDetails/InstanceDetails.tsx',
    'screens/onboarding/Landing/Landing.tsx',
    'screens/onboarding/Welcome/Welcome.tsx',
  ];

  it('lists 22 screens', () => {
    expect(new Set(screens).size).toBe(22);
  });

  it.each(screens)('src/%s imports and renders ScreenSafeArea', screen => {
    const text = fs.readFileSync(path.join(srcDir, screen), 'utf-8');
    expect(text).toMatch(
      /import\s*\{\s*ScreenSafeArea\s*\}\s*from\s*['"]@app\/components\/ScreenSafeArea\/ScreenSafeArea['"]/,
    );
    expect(text).toMatch(/<ScreenSafeArea\b/);
  });
});
