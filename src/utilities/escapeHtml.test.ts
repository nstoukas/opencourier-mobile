import { escapeHtml } from './escapeHtml';

// Row 105: notifee reads an Android notification's title and body as HTML, so text from outside the
// app has &, < and > written as entities.
describe('escapeHtml (row 105)', () => {
  it('writes &, < and > as entities', () => {
    expect(escapeHtml('<b>Bold</b> & Co')).toBe(
      '&lt;b&gt;Bold&lt;/b&gt; &amp; Co',
    );
  });

  it('escapes & first, so an entity already in the text is shown as typed, not swallowed', () => {
    // If & were replaced after < and >, '<' would become '&amp;lt;'.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('a && b')).toBe('a &amp;&amp; b');
  });

  it('escapes every occurrence, not only the first', () => {
    expect(escapeHtml('<<>>&&')).toBe('&lt;&lt;&gt;&gt;&amp;&amp;');
  });

  it('leaves other text unchanged, Greek and quotes included', () => {
    const plain = 'Ταβέρνα "Ο Μήτσος" · O\'Brien\'s 1.2 km';
    expect(escapeHtml(plain)).toBe(plain);
    expect(escapeHtml('')).toBe('');
  });
});
