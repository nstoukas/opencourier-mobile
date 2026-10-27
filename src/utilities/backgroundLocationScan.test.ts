import fs from 'fs';
import path from 'path';

describe('Background location declarations and service registration (spec 0008, AC-5, AC-7)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const manifestPath = path.join(
    rootDir,
    'android/app/src/main/AndroidManifest.xml',
  );
  const indexJsPath = path.join(rootDir, 'index.js');
  const infoPlistPath = path.join(rootDir, 'ios/OpenCourier/Info.plist');

  describe('AC-5: AndroidManifest.xml and index.js', () => {
    it('declares FOREGROUND_SERVICE_LOCATION in AndroidManifest.xml', () => {
      const manifest = fs.readFileSync(manifestPath, 'utf-8');

      expect(manifest).toMatch(
        /<uses-permission\s+android:name="android\.permission\.FOREGROUND_SERVICE_LOCATION"\s*\/>/,
      );
    });

    it('declares app.notifee.core.ForegroundService with foregroundServiceType="location"', () => {
      const manifest = fs.readFileSync(manifestPath, 'utf-8');

      // Match the service tag with android:name="app.notifee.core.ForegroundService" and android:foregroundServiceType="location"
      expect(manifest).toMatch(
        /<service[\s\S]*?android:name="app\.notifee\.core\.ForegroundService"[\s\S]*?android:foregroundServiceType="location"[\s\S]*?\/>/,
      );
    });

    it('does NOT declare ACCESS_BACKGROUND_LOCATION as a uses-permission (value 5)', () => {
      const manifest = fs.readFileSync(manifestPath, 'utf-8');

      // Strip XML comments so mentions in comments are allowed
      const withoutComments = manifest.replace(/<!--[\s\S]*?-->/g, '');

      expect(withoutComments).not.toMatch(
        /<uses-permission[\s\S]*?android\.permission\.ACCESS_BACKGROUND_LOCATION[\s\S]*?\/>/,
      );
    });

    it('index.js registers notifee.registerForegroundService at module level', () => {
      const indexContent = fs.readFileSync(indexJsPath, 'utf-8');

      expect(indexContent).toMatch(/notifee\.registerForegroundService\s*\(/);
    });
  });

  describe('AC-7: Info.plist UIBackgroundModes', () => {
    it('declares UIBackgroundModes array containing location in Info.plist', () => {
      const plist = fs.readFileSync(infoPlistPath, 'utf-8');

      expect(plist).toContain('<key>UIBackgroundModes</key>');
      expect(plist).toMatch(
        /<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>location<\/string>[\s\S]*?<\/array>/,
      );
    });
  });
});
