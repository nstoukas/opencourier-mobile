import fs from 'fs';
import path from 'path';

/**
 * Scope row 1 guard (docs/scope/platform.md row 1, 'Move the mobile Maps key out of AndroidManifest.xml'):
 * The Google Maps key must never be written in a tracked file again.
 *
 * (a) AndroidManifest.xml must set com.google.android.geo.API_KEY meta-data value to ${mapsApiKey}
 *     and must not contain any string matching AIza[0-9A-Za-z_-]{30,}
 * (b) android/app/build.gradle defaultConfig must set manifestPlaceholders with mapsApiKey,
 *     read from MAPS_API_KEY (from local.properties or environment).
 *
 * Never print a key value in test names or messages.
 */

const GOOGLE_API_KEY_REGEX = /AIza[0-9A-Za-z_-]{30,}/;

/**
 * Checks whether content contains any string matching the Google API key pattern.
 */
export function hasGoogleApiKeyPattern(content: string): boolean {
  return GOOGLE_API_KEY_REGEX.test(content);
}

/**
 * Extracts the android:value of com.google.android.geo.API_KEY from AndroidManifest.xml.
 * Returns null if the meta-data tag is not found.
 */
export function getGeoApiKeyMetaDataValue(manifestXml: string): string | null {
  const withoutComments = manifestXml.replace(/<!--[\s\S]*?-->/g, '');
  const metaDataTags =
    withoutComments.match(/<meta-data\b[\s\S]*?(?:\/>|<\/meta-data>)/g) ?? [];
  const geoApiKeyTag = metaDataTags.find(tag =>
    /android:name="com\.google\.android\.geo\.API_KEY"/.test(tag),
  );
  if (!geoApiKeyTag) {
    return null;
  }
  const match = /android:value="([^"]*)"/.exec(geoApiKeyTag);
  return match ? match[1] : null;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates that AndroidManifest.xml:
 * 1. Contains no Google API key matching the AIza pattern (even in comments).
 * 2. Has com.google.android.geo.API_KEY meta-data whose value is exactly ${mapsApiKey}.
 * Never leaks/prints any actual key in error messages.
 */
export function validateAndroidManifestMapsKey(
  manifestXml: string,
): ValidationResult {
  if (hasGoogleApiKeyPattern(manifestXml)) {
    return {
      valid: false,
      reason:
        'A string matching Google API key pattern AIza[0-9A-Za-z_-]{30,} was found in AndroidManifest.xml',
    };
  }

  const metaDataValue = getGeoApiKeyMetaDataValue(manifestXml);
  if (metaDataValue === null) {
    return {
      valid: false,
      reason:
        'com.google.android.geo.API_KEY meta-data tag is missing from AndroidManifest.xml',
    };
  }

  if (metaDataValue !== '${mapsApiKey}') {
    return {
      valid: false,
      reason:
        'com.google.android.geo.API_KEY meta-data value must be ${mapsApiKey}',
    };
  }

  return { valid: true };
}

/**
 * Extracts the content of a balanced curly brace block { ... } following a name.
 */
export function extractBlock(
  content: string,
  blockName: string,
): string | null {
  const startIndex = content.indexOf(blockName);
  if (startIndex === -1) {
    return null;
  }
  const openBrace = content.indexOf('{', startIndex);
  if (openBrace === -1) {
    return null;
  }
  let depth = 1;
  let i = openBrace + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') {
      depth++;
    } else if (content[i] === '}') {
      depth--;
    }
    i++;
  }
  if (depth !== 0) {
    return null;
  }
  return content.substring(openBrace + 1, i - 1);
}

/**
 * Checks whether code actively reads from MAPS_API_KEY (via getProperty, getenv, or map access).
 * Ignores comments and logger statements so a mere warning or comment doesn't satisfy the check.
 */
export function readsFromMapsApiKey(code: string): boolean {
  const cleaned = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/logger\.[a-zA-Z]+\([^)]*\)/g, '');

  return (
    /(?:getProperty|getenv|findProperty|get)\(\s*['"]MAPS_API_KEY['"]\s*\)/.test(
      cleaned,
    ) || /\[\s*['"]MAPS_API_KEY['"]\s*\]/.test(cleaned)
  );
}

/**
 * Validates that android/app/build.gradle:
 * 1. Has a defaultConfig block.
 * 2. defaultConfig sets manifestPlaceholders with mapsApiKey.
 * 3. mapsApiKey is read from MAPS_API_KEY (from local.properties or environment).
 */
export function validateBuildGradleMapsPlaceholder(
  buildGradleContent: string,
): ValidationResult {
  const defaultConfig = extractBlock(buildGradleContent, 'defaultConfig');
  if (!defaultConfig) {
    return {
      valid: false,
      reason: 'defaultConfig block not found in build.gradle',
    };
  }

  const placeholderMatch =
    defaultConfig.match(
      /manifestPlaceholders\s*=\s*\[[\s\S]*?\bmapsApiKey\s*:\s*([^,\]\r\n]+)/,
    ) ||
    defaultConfig.match(
      /manifestPlaceholders(?:\[['"]mapsApiKey['"]\]|\.put\(\s*['"]mapsApiKey['"]\s*,)\s*[:=]?\s*([^);\r\n]+)/,
    );

  if (!placeholderMatch) {
    return {
      valid: false,
      reason:
        'defaultConfig does not set manifestPlaceholders with mapsApiKey',
    };
  }

  const assignedExpr = placeholderMatch[1].trim();

  // If directly reading MAPS_API_KEY in the placeholder expression
  if (readsFromMapsApiKey(assignedExpr)) {
    return { valid: true };
  }

  const fnNameMatch = /^([a-zA-Z0-9_]+)(?:\(\))?$/.exec(assignedExpr);
  if (!fnNameMatch) {
    return {
      valid: false,
      reason:
        'manifestPlaceholders mapsApiKey is not read from MAPS_API_KEY',
    };
  }

  const fnName = fnNameMatch[1];
  const fnBlock =
    extractBlock(buildGradleContent, `def ${fnName}()`) ||
    extractBlock(buildGradleContent, `${fnName}()`);
  if (fnBlock) {
    if (readsFromMapsApiKey(fnBlock)) {
      return { valid: true };
    }
    return {
      valid: false,
      reason: `${fnName}() does not read MAPS_API_KEY`,
    };
  }

  const varDefMatch = new RegExp(
    `def\\s+${fnName}\\s*=\\s*([^\\n]+)`,
  ).exec(buildGradleContent);
  if (varDefMatch && readsFromMapsApiKey(varDefMatch[1])) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `mapsApiKey definition for ${assignedExpr} reading MAPS_API_KEY not found in build.gradle`,
  };
}

describe('Google Maps API key guard (Scope row 1)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const manifestPath = path.join(
    rootDir,
    'android/app/src/main/AndroidManifest.xml',
  );
  const buildGradlePath = path.join(rootDir, 'android/app/build.gradle');

  describe('real repository files', () => {
    it('android/app/src/main/AndroidManifest.xml sets com.google.android.geo.API_KEY to ${mapsApiKey} placeholder and contains no Google API key', () => {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

      // (a) Must not contain any string matching AIza[0-9A-Za-z_-]{30,}
      const hasApiKey = hasGoogleApiKeyPattern(manifestContent);
      expect(hasApiKey).toBe(false);

      // (a) com.google.android.geo.API_KEY meta-data value must be exactly ${mapsApiKey}
      const metaDataValue = getGeoApiKeyMetaDataValue(manifestContent);
      const isExpectedPlaceholder = metaDataValue === '${mapsApiKey}';
      expect(isExpectedPlaceholder).toBe(true);

      // Complete validation must pass
      const validation = validateAndroidManifestMapsKey(manifestContent);
      expect(validation).toEqual({ valid: true });
    });

    it('android/app/build.gradle defaultConfig sets manifestPlaceholders with mapsApiKey read from MAPS_API_KEY', () => {
      const gradleContent = fs.readFileSync(buildGradlePath, 'utf-8');

      // (b) defaultConfig sets manifestPlaceholders with mapsApiKey, read from MAPS_API_KEY
      const validation = validateBuildGradleMapsPlaceholder(gradleContent);
      expect(validation).toEqual({ valid: true });
    });
  });

  describe('guard behavior checks: AndroidManifest.xml', () => {
    const validManifestSample = `
      <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        <application>
          <meta-data
              android:name="com.google.android.geo.API_KEY"
              android:value="\${mapsApiKey}"/>
        </application>
      </manifest>
    `;

    it('passes when com.google.android.geo.API_KEY is ${mapsApiKey} and no key pattern is present', () => {
      const result = validateAndroidManifestMapsKey(validManifestSample);
      expect(result).toEqual({ valid: true });
    });

    it('fails when com.google.android.geo.API_KEY meta-data tag is missing', () => {
      const sampleWithoutTag = `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application />
        </manifest>
      `;
      const result = validateAndroidManifestMapsKey(sampleWithoutTag);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('meta-data tag is missing');
    });

    it('fails when com.google.android.geo.API_KEY value is empty', () => {
      const sampleWithEmpty = validManifestSample.replace(
        '${mapsApiKey}',
        '',
      );
      const result = validateAndroidManifestMapsKey(sampleWithEmpty);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('meta-data value must be ${mapsApiKey}');
    });

    it('fails when com.google.android.geo.API_KEY value is anything other than ${mapsApiKey}', () => {
      const sampleWithOther = validManifestSample.replace(
        '${mapsApiKey}',
        'some_other_placeholder',
      );
      const result = validateAndroidManifestMapsKey(sampleWithOther);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('meta-data value must be ${mapsApiKey}');
    });

    it('fails when an API key matching AIza pattern appears in the manifest', () => {
      // Use a dummy pattern match without printing or leaking any real key
      const dummyPatternMatch =
        'AIza' + 'DummyPatternStringForTestingOnly1234567890';
      const sampleWithKey = validManifestSample.replace(
        '${mapsApiKey}',
        dummyPatternMatch,
      );
      const result = validateAndroidManifestMapsKey(sampleWithKey);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('AIza[0-9A-Za-z_-]{30,}');
    });

    it('fails when an API key matching AIza pattern appears in comments', () => {
      const dummyPatternMatch =
        'AIza' + 'DummyCommentStringForTestingOnly1234567890';
      const sampleWithComment = `<!-- key: ${dummyPatternMatch} -->\n${validManifestSample}`;
      const result = validateAndroidManifestMapsKey(sampleWithComment);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('AIza[0-9A-Za-z_-]{30,}');
    });
  });

  describe('guard behavior checks: build.gradle', () => {
    const validGradleSample = `
      def mapsApiKey() {
          def properties = new Properties()
          def file = rootProject.file('local.properties')
          if (file.exists()) {
              file.withInputStream { properties.load(it) }
          }
          def key = properties.getProperty('MAPS_API_KEY') ?: System.getenv('MAPS_API_KEY')
          if (!key) {
              logger.warn('MAPS_API_KEY is not set')
              return ''
          }
          return key
      }
      android {
          defaultConfig {
              versionCode 1
              manifestPlaceholders = [mapsApiKey: mapsApiKey()]
          }
      }
    `;

    it('passes when defaultConfig sets manifestPlaceholders with mapsApiKey reading MAPS_API_KEY', () => {
      const result = validateBuildGradleMapsPlaceholder(validGradleSample);
      expect(result).toEqual({ valid: true });
    });

    it('passes when manifestPlaceholders sets mapsApiKey directly reading MAPS_API_KEY', () => {
      const inlineSample = `
        android {
            defaultConfig {
                manifestPlaceholders = [mapsApiKey: System.getenv('MAPS_API_KEY')]
            }
        }
      `;
      const result = validateBuildGradleMapsPlaceholder(inlineSample);
      expect(result).toEqual({ valid: true });
    });

    it('fails when defaultConfig block is missing', () => {
      const noDefaultConfig = 'android { namespace "com.opendeli" }';
      const result = validateBuildGradleMapsPlaceholder(noDefaultConfig);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('defaultConfig block not found');
    });

    it('fails when manifestPlaceholders is not set in defaultConfig', () => {
      const noPlaceholders = `
        android {
            defaultConfig {
                versionCode 1
            }
        }
      `;
      const result = validateBuildGradleMapsPlaceholder(noPlaceholders);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain(
        'defaultConfig does not set manifestPlaceholders with mapsApiKey',
      );
    });

    it('fails when manifestPlaceholders sets other keys but not mapsApiKey', () => {
      const otherPlaceholders = `
        android {
            defaultConfig {
                manifestPlaceholders = [otherPlaceholder: 'foo']
            }
        }
      `;
      const result = validateBuildGradleMapsPlaceholder(otherPlaceholders);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain(
        'defaultConfig does not set manifestPlaceholders with mapsApiKey',
      );
    });

    it('fails when mapsApiKey helper does not read MAPS_API_KEY', () => {
      const wrongHelper = validGradleSample.replace(
        /MAPS_API_KEY/g,
        'OTHER_UNRECOGNIZED_KEY',
      );
      const result = validateBuildGradleMapsPlaceholder(wrongHelper);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('does not read MAPS_API_KEY');
    });

    it('fails when mapsApiKey is set to a hardcoded string', () => {
      const hardcoded = `
        android {
            defaultConfig {
                manifestPlaceholders = [mapsApiKey: 'hardcoded_value']
            }
        }
      `;
      const result = validateBuildGradleMapsPlaceholder(hardcoded);
      expect(result.valid).toBe(false);
    });
  });
});
