import fs from 'fs';
import path from 'path';
import translations from './translations';

describe('chat translations (spec 0034, AC-5, AC-6, AC-11, AC-13, AC-19)', () => {
  const expectedKeys = [
    'chat',
    'chat_dispatch',
    'chat_channel',
    'chat_notice_title',
    'chat_placeholder',
    'chat_send',
    'chat_sending',
    'chat_not_sent',
    'chat_read',
    'chat_about_order',
    'chat_empty',
    'chat_load_failed',
    'chat_unread',
  ];

  for (const key of expectedKeys) {
    it(`defines key "${key}" in translations`, () => {
      expect(translations).toHaveProperty(key);
      expect((translations as any)[key]).toBeTruthy();
      expect(typeof (translations as any)[key]).toBe('string');
    });
  }

  it('scans all source files and verifies every chat_* translation key used exists in translations.ts', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const usedChatKeys = new Set<string>();

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx')
        ) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          // Match translations:chat_* or 'chat_*'
          const regex = /\bchat_[a-z0-9_]+/g;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(content)) !== null) {
            // Exclude non-translation constants like chat_last_seen_message
            if (match[0] !== 'chat_last_seen_message') {
              usedChatKeys.add(match[0]);
            }
          }
        }
      }
    }

    scanDir(srcDir);

    expect(usedChatKeys.size).toBeGreaterThan(0);
    for (const key of usedChatKeys) {
      expect(translations).toHaveProperty(key);
    }
  });
});
