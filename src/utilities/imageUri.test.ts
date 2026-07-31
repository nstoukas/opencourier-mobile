import { hasImageUri } from './imageUri';

describe('hasImageUri', () => {
  it('returns true for a valid image URL', () => {
    expect(hasImageUri('https://example.com/logo.png')).toBe(true);
  });

  it('returns false for an empty string', () => {
    // instanceService.ts:48 turns missing logos into empty strings (''), causing LogBox warnings.
    expect(hasImageUri('')).toBe(false);
  });

  it('returns false for whitespace-only strings', () => {
    expect(hasImageUri('   ')).toBe(false);
  });

  it('returns false for undefined', () => {
    // Registry details may omit the imageUrl key entirely.
    expect(hasImageUri(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasImageUri(null)).toBe(false);
  });
});
