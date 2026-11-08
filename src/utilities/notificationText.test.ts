import { Platform } from 'react-native';
import { notificationText } from './notificationText';

// Row 105: Android's notifee reads a notification's title and body as HTML, iOS shows plain text.
describe('notificationText (row 105)', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('escapes &, < and > on Android', () => {
    Platform.OS = 'android';
    expect(notificationText('<b>Bold</b> & Co: cancelled by the co-op.')).toBe(
      '&lt;b&gt;Bold&lt;/b&gt; &amp; Co: cancelled by the co-op.',
    );
  });

  it('returns the text unchanged on iOS, where an entity would show as typed', () => {
    Platform.OS = 'ios';
    const text = '<b>Bold</b> & Co: cancelled by the co-op.';
    expect(notificationText(text)).toBe(text);
  });

  it('reads the platform at call time, not when the module loads', () => {
    Platform.OS = 'ios';
    expect(notificationText('A & B')).toBe('A & B');
    Platform.OS = 'android';
    expect(notificationText('A & B')).toBe('A &amp; B');
  });

  it('leaves text with nothing to escape unchanged on Android', () => {
    Platform.OS = 'android';
    expect(notificationText('Ταβέρνα Ο Μήτσος')).toBe('Ταβέρνα Ο Μήτσος');
  });
});
