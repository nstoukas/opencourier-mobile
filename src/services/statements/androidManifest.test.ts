import fs from 'fs';
import path from 'path';

// Spec 0050, review ruling of 2026-11-21 (row 76): react-native-blob-util declares permissions the rider
// app does not need, and Android merges a library's manifest into the app's. The app's own manifest takes
// four of them out with tools:node="remove". WAKE_LOCK, which the library also declares, stays: Firebase
// messaging needs it. This test reads the manifest file itself, so the lines cannot be dropped unseen.

const MANIFEST = path.resolve(
  __dirname,
  '../../../android/app/src/main/AndroidManifest.xml',
);

interface PermissionLine {
  name: string;
  removed: boolean;
}

// Every <uses-permission> element in the file, comments left out.
const permissionLines = (xml: string): PermissionLine[] => {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  const elements = withoutComments.match(/<uses-permission\b[^>]*>/g) ?? [];
  return elements.map(element => ({
    name: /android:name="([^"]+)"/.exec(element)?.[1] ?? '',
    removed: /tools:node="remove"/.test(element),
  }));
};

describe("the rider app's Android manifest (spec 0050, review fix)", () => {
  const xml = fs.readFileSync(MANIFEST, 'utf8');
  const lines = permissionLines(xml);
  const of = (permission: string) =>
    lines.filter(line => line.name === `android.permission.${permission}`);

  it('reads the real manifest', () => {
    expect(xml).toContain('<manifest');
    expect(lines.length).toBeGreaterThan(5);
    expect(of('INTERNET')).toEqual([
      { name: 'android.permission.INTERNET', removed: false },
    ]);
  });

  it('declares the tools namespace, without which tools:node is not understood', () => {
    expect(xml).toMatch(
      /<manifest[^>]*xmlns:tools="http:\/\/schemas\.android\.com\/tools"/,
    );
  });

  it.each([
    'ACCESS_WIFI_STATE',
    'WRITE_EXTERNAL_STORAGE',
    'READ_EXTERNAL_STORAGE',
    'DOWNLOAD_WITHOUT_NOTIFICATION',
  ])(
    '%s is taken out of the merged manifest with tools:node="remove"',
    permission => {
      // Once, as a removal, and never also asked for.
      expect(of(permission)).toEqual([
        { name: `android.permission.${permission}`, removed: true },
      ]);
    },
  );

  it('WAKE_LOCK is not removed (Firebase messaging needs it)', () => {
    expect(of('WAKE_LOCK').filter(line => line.removed)).toEqual([]);
  });

  it('removes those four and nothing else', () => {
    expect(
      lines
        .filter(line => line.removed)
        .map(line => line.name.replace('android.permission.', ''))
        .sort(),
    ).toEqual([
      'ACCESS_WIFI_STATE',
      'DOWNLOAD_WITHOUT_NOTIFICATION',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ]);
  });

  it('the library really declares them, so the removals are needed', () => {
    const library = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../node_modules/react-native-blob-util/android/src/main/AndroidManifest.xml',
      ),
      'utf8',
    );
    const declared = permissionLines(library).map(line =>
      line.name.replace('android.permission.', ''),
    );

    expect(declared).toEqual(
      expect.arrayContaining([
        'ACCESS_WIFI_STATE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_EXTERNAL_STORAGE',
        'DOWNLOAD_WITHOUT_NOTIFICATION',
        'WAKE_LOCK',
      ]),
    );
  });
});
