// On Android notifee reads a notification's body and big text as HTML (row 100): text from outside the
// app (a restaurant's name) must have &, < and > written as entities, or its tags are swallowed or
// add markup. iOS shows plain text, so callers escape on Android only.
export const escapeHtml = (line: string): string =>
  line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
