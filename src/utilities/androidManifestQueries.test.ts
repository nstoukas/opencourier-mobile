import fs from 'fs';
import path from 'path';
import { MapLinkingOptions } from '@app/types/types';
import { mapProbeUrl } from './mapLinks';

describe('Android 11+ package visibility queries (Row 66, Clause 2)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const manifestPath = path.join(
    rootDir,
    'android/app/src/main/AndroidManifest.xml',
  );

  it('android/app/src/main/AndroidManifest.xml contains a <queries> block with VIEW intents for google.navigation and waze', () => {
    const content = fs.readFileSync(manifestPath, 'utf-8');

    expect(content).toContain('<queries>');
    expect(content).toContain('</queries>');

    // Check that queries block has intent with VIEW action and google.navigation scheme
    expect(content).toMatch(
      /<intent>[\s\S]*?<action android:name="android\.intent\.action\.VIEW"\s*\/>[\s\S]*?<data android:scheme="google\.navigation"\s*\/>[\s\S]*?<\/intent>/,
    );

    // Check that queries block has intent with VIEW action and waze scheme
    expect(content).toMatch(
      /<intent>[\s\S]*?<action android:name="android\.intent\.action\.VIEW"\s*\/>[\s\S]*?<data android:scheme="waze"\s*\/>[\s\S]*?<\/intent>/,
    );
  });

  it('on Android the app probes google.navigation with Linking.canOpenURL, not comgooglemaps', () => {
    const probe = mapProbeUrl(MapLinkingOptions.google, 'android');
    expect(probe).toContain('google.navigation:');
    expect(probe).not.toContain('comgooglemaps');
  });
});
