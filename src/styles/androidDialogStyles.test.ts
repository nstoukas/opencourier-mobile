import fs from 'fs';
import path from 'path';

// Row 124 (Greek interface loose ends) & Decisions 124.5, 124.12, 124.13:
// Android's own dialog buttons (React Native's Alert.alert) default to all caps,
// which keeps Greek accents ("ΑΠΟΧΏΡΗΣΗ", wrong in Greek: capital Greek words drop accents).
// Sentence case ("Αποχώρηση") fixes this.
// To apply sentence case, AppTheme must set both android:buttonBarButtonStyle (read by RN 0.74's
// framework AlertDialog) and buttonBarButtonStyle (read by newer RN's AppCompat AlertDialog)
// to a button style with textAllCaps false (both android:textAllCaps and appcompat textAllCaps).

const STYLES_XML_PATH = path.resolve(
  __dirname,
  '../../android/app/src/main/res/values/styles.xml',
);

export interface StyleDefinition {
  name: string;
  parent?: string;
  items: Record<string, string>;
}

// Parses <style> and <item> definitions from an Android XML string, stripping XML comments.
export function parseStylesXml(xml: string): Record<string, StyleDefinition> {
  // Strip XML comments so commented-out styles or attributes are not treated as active
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  const styleRegex = /<style\s+([^>]*?)>([\s\S]*?)<\/style>/g;
  const styles: Record<string, StyleDefinition> = {};

  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRegex.exec(withoutComments)) !== null) {
    const attrsStr = styleMatch[1];
    const bodyStr = styleMatch[2];

    const nameMatch = /name="([^"]+)"/.exec(attrsStr);
    if (!nameMatch) {
      continue;
    }
    const styleName = nameMatch[1];

    const parentMatch = /parent="([^"]+)"/.exec(attrsStr);
    const parent = parentMatch ? parentMatch[1] : undefined;

    const itemRegex = /<item\s+name="([^"]+)">([^<]*)<\/item>/g;
    const items: Record<string, string> = {};
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(bodyStr)) !== null) {
      items[itemMatch[1].trim()] = itemMatch[2].trim();
    }

    styles[styleName] = {
      name: styleName,
      parent,
      items,
    };
  }

  return styles;
}

// Validates that AppTheme points both button bar style attributes at a style with textAllCaps false
export function validateDialogButtonStyles(xml: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const styles = parseStylesXml(xml);

  const appTheme = styles.AppTheme;
  if (!appTheme) {
    errors.push('AppTheme style is not defined in styles.xml');
    return { valid: false, errors };
  }

  const androidAttr = 'android:buttonBarButtonStyle';
  const appCompatAttr = 'buttonBarButtonStyle';

  const androidRef = appTheme.items[androidAttr];
  if (!androidRef) {
    errors.push(`AppTheme is missing item "${androidAttr}"`);
  }

  const appCompatRef = appTheme.items[appCompatAttr];
  if (!appCompatRef) {
    errors.push(`AppTheme is missing item "${appCompatAttr}"`);
  }

  const requiredAttributes = [
    { attr: androidAttr, ref: androidRef },
    { attr: appCompatAttr, ref: appCompatRef },
  ];

  for (const { attr, ref } of requiredAttributes) {
    if (!ref) {
      continue;
    }

    const styleName = ref.replace(/^@style\//, '');
    const targetStyle = styles[styleName];

    if (!targetStyle) {
      errors.push(
        `AppTheme "${attr}" points to "${ref}", but style "${styleName}" is not defined`,
      );
      continue;
    }

    if (targetStyle.items['android:textAllCaps'] !== 'false') {
      errors.push(
        `Style "${styleName}" pointed to by "${attr}" must set android:textAllCaps to "false", got "${
          targetStyle.items['android:textAllCaps'] ?? 'undefined'
        }"`,
      );
    }

    if (targetStyle.items.textAllCaps !== 'false') {
      errors.push(
        `Style "${styleName}" pointed to by "${attr}" must set textAllCaps to "false", got "${
          targetStyle.items.textAllCaps ?? 'undefined'
        }"`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('Android dialog button styles (Row 124, Decisions 124.5 & 124.12)', () => {
  const xmlContent = fs.readFileSync(STYLES_XML_PATH, 'utf8');
  const styles = parseStylesXml(xmlContent);

  it('reads android/app/src/main/res/values/styles.xml and parses the resource styles', () => {
    expect(fs.existsSync(STYLES_XML_PATH)).toBe(true);
    expect(xmlContent).toContain('<resources>');
    expect(styles.AppTheme).toBeDefined();
    expect(styles.DialogButton).toBeDefined();
  });

  it('AppTheme points android:buttonBarButtonStyle at @style/DialogButton', () => {
    // Framework AlertDialog (RN 0.74) reads android:buttonBarButtonStyle from AppTheme
    expect(styles.AppTheme.items['android:buttonBarButtonStyle']).toBe(
      '@style/DialogButton',
    );
  });

  it('AppTheme points buttonBarButtonStyle at @style/DialogButton', () => {
    // AppCompat AlertDialog (newer RN versions) reads unprefixed buttonBarButtonStyle
    expect(styles.AppTheme.items.buttonBarButtonStyle).toBe(
      '@style/DialogButton',
    );
  });

  it('DialogButton disables all caps with android:textAllCaps="false"', () => {
    // Framework button reads android:textAllCaps to prevent accented Greek capitals
    expect(styles.DialogButton.items['android:textAllCaps']).toBe('false');
  });

  it('DialogButton disables all caps with textAllCaps="false"', () => {
    // AppCompatButton reads app-namespaced textAllCaps to prevent accented Greek capitals
    expect(styles.DialogButton.items.textAllCaps).toBe('false');
  });

  it('DialogButton inherits from AppCompat AlertDialog button bar widget', () => {
    // Decision 124.12: inherits public Widget.AppCompat.Button.ButtonBar.AlertDialog
    expect(styles.DialogButton.parent).toBe(
      'Widget.AppCompat.Button.ButtonBar.AlertDialog',
    );
  });

  it('validates successfully against the real styles.xml', () => {
    const result = validateDialogButtonStyles(xmlContent);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  describe('Edge cases and failure detection in dialog button validation', () => {
    it('fails when AppTheme is missing android:buttonBarButtonStyle', () => {
      const xmlWithoutAndroidAttr = `
        <resources>
          <style name="AppTheme">
            <item name="buttonBarButtonStyle">@style/DialogButton</item>
          </style>
          <style name="DialogButton">
            <item name="android:textAllCaps">false</item>
            <item name="textAllCaps">false</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithoutAndroidAttr);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AppTheme is missing item "android:buttonBarButtonStyle"',
      );
    });

    it('fails when AppTheme is missing buttonBarButtonStyle', () => {
      const xmlWithoutAppCompatAttr = `
        <resources>
          <style name="AppTheme">
            <item name="android:buttonBarButtonStyle">@style/DialogButton</item>
          </style>
          <style name="DialogButton">
            <item name="android:textAllCaps">false</item>
            <item name="textAllCaps">false</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithoutAppCompatAttr);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AppTheme is missing item "buttonBarButtonStyle"',
      );
    });

    it('fails when the referenced style is missing', () => {
      const xmlWithMissingStyle = `
        <resources>
          <style name="AppTheme">
            <item name="android:buttonBarButtonStyle">@style/NonExistentButton</item>
            <item name="buttonBarButtonStyle">@style/NonExistentButton</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithMissingStyle);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('style "NonExistentButton" is not defined'),
        ]),
      );
    });

    it('fails when android:textAllCaps is not false (e.g. true or missing)', () => {
      const xmlWithTrueAndroidAllCaps = `
        <resources>
          <style name="AppTheme">
            <item name="android:buttonBarButtonStyle">@style/DialogButton</item>
            <item name="buttonBarButtonStyle">@style/DialogButton</item>
          </style>
          <style name="DialogButton">
            <item name="android:textAllCaps">true</item>
            <item name="textAllCaps">false</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithTrueAndroidAllCaps);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'must set android:textAllCaps to "false", got "true"',
          ),
        ]),
      );
    });

    it('fails when textAllCaps is not false (e.g. true or missing)', () => {
      const xmlWithTrueAppCompatAllCaps = `
        <resources>
          <style name="AppTheme">
            <item name="android:buttonBarButtonStyle">@style/DialogButton</item>
            <item name="buttonBarButtonStyle">@style/DialogButton</item>
          </style>
          <style name="DialogButton">
            <item name="android:textAllCaps">false</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithTrueAppCompatAllCaps);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'must set textAllCaps to "false", got "undefined"',
          ),
        ]),
      );
    });

    it('ignores items inside XML comments so commented-out attributes fail', () => {
      const xmlWithCommentedItem = `
        <resources>
          <style name="AppTheme">
            <!-- <item name="android:buttonBarButtonStyle">@style/DialogButton</item> -->
            <item name="buttonBarButtonStyle">@style/DialogButton</item>
          </style>
          <style name="DialogButton">
            <item name="android:textAllCaps">false</item>
            <item name="textAllCaps">false</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithCommentedItem);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AppTheme is missing item "android:buttonBarButtonStyle"',
      );
    });

    it('fails when AppTheme is not defined', () => {
      const xmlWithoutAppTheme = `
        <resources>
          <style name="OtherTheme">
            <item name="android:buttonBarButtonStyle">@style/DialogButton</item>
          </style>
        </resources>
      `;
      const result = validateDialogButtonStyles(xmlWithoutAppTheme);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AppTheme style is not defined in styles.xml',
      );
    });
  });
});
