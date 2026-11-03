import { Platform } from 'react-native';
import { escapeHtml } from './escapeHtml';

// Row 105: text for a notification's title or body that carries anything from outside the app (a
// restaurant's name). Android's notifee reads both as HTML, so there it is escaped; iOS shows plain
// text, where an entity would show as typed. Our own fixed sentences need no escaping.
export const notificationText = (text: string): string =>
  Platform.OS === 'android' ? escapeHtml(text) : text;
