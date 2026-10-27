import fs from 'fs';
import path from 'path';

describe('Source and config scan (Row 18, no photos / no camera)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const srcDir = path.resolve(__dirname, '..');

  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getSourceFiles(fullPath));
      } else if (
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('no file in src imports react-native-camera or names PhotoAttachment or useCameraPermission', () => {
    const files = getSourceFiles(srcDir);
    const violations: string[] = [];

    const forbiddenPatterns = [
      { name: 'react-native-camera', regex: /react-native-camera/ },
      { name: 'PhotoAttachment', regex: /PhotoAttachment/ },
      { name: 'useCameraPermission', regex: /useCameraPermission/ },
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.regex.test(line)) {
            const relPath = path.relative(srcDir, file);
            violations.push(
              `src/${relPath}:${index + 1}: found ${
                pattern.name
              } -> "${line.trim()}"`,
            );
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('package.json has no react-native-camera dependency', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    expect(packageJson.dependencies?.['react-native-camera']).toBeUndefined();
    expect(
      packageJson.devDependencies?.['react-native-camera'],
    ).toBeUndefined();
    expect(content).not.toContain('react-native-camera');
  });

  it('android/app/src/main/AndroidManifest.xml has no android.permission.CAMERA and no android.hardware.camera', () => {
    const manifestPath = path.join(
      rootDir,
      'android/app/src/main/AndroidManifest.xml',
    );
    const content = fs.readFileSync(manifestPath, 'utf-8');

    expect(content).not.toContain('android.permission.CAMERA');
    expect(content).not.toContain('android.hardware.camera');
  });

  it('ios/OpenCourier/Info.plist has no NSCameraUsageDescription', () => {
    const plistPath = path.join(rootDir, 'ios/OpenCourier/Info.plist');
    const content = fs.readFileSync(plistPath, 'utf-8');

    expect(content).not.toContain('NSCameraUsageDescription');
  });
});
