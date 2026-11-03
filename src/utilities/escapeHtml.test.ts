import fs from 'fs';
import path from 'path';
import { escapeHtml } from './escapeHtml';

// notifee reads an Android notification's body as HTML (row 100), so text from outside the app
// (a restaurant's name) is escaped: &, < and > become entities.
describe('escapeHtml (row 100, row 21 review)', () => {
  it('writes &, < and > as entities', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('Tom & Jerry <b>Grill</b>')).toBe(
      'Tom &amp; Jerry &lt;b&gt;Grill&lt;/b&gt;',
    );
  });

  it('escapes & first, so an entity already in the text is escaped once, not twice', () => {
    expect(escapeHtml('a &lt; b')).toBe('a &amp;lt; b');
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('leaves every other character as it is', () => {
    const plain =
      'Ψητοπωλείο "Ο Νίκος" \'s 12:30 · 2,5 km / ~3 min; €4.50 #1 %';
    expect(escapeHtml(plain)).toBe(plain);
    expect(escapeHtml('')).toBe('');
  });

  // One copy of the rule: the offer alert and the ready notice both import it, neither keeps its own.
  it.each([
    ['offer alert', '../services/offerPush/offerAlert.ts'],
    ['ready notice', '../services/readyNotice/readyNotice.ts'],
  ])(
    'the %s imports the shared escapeHtml and defines none of its own',
    (_, file) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf-8');
      expect(source).toMatch(
        /import \{ escapeHtml \} from '@app\/utilities\/escapeHtml';/,
      );
      expect(source).not.toMatch(/(const|function|let|var)\s+escapeHtml\b/);
      expect(source).toMatch(/escapeHtml\(/);
    },
  );
});
