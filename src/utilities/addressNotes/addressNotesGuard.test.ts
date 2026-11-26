import fs from 'fs';
import path from 'path';
import { looksLikePersonalData } from './personalDataCheck';

// Spec 0053 (AC-3, AC-9, Cross check 5, 12, Value 5):
// Notes describe the place, never the person.
// Guard tests verifying that no author data or author metrics leak,
// and that personal data requires confirmation.
// Note: byte-for-byte check of given-names.json (cross check 6) is in givenNamesParity.test.ts (row 174).
describe('Address notes guards (spec 0053, AC-3, AC-9, Cross check 5, 12)', () => {
  const srcDir = path.resolve(__dirname, '../..');

  it('Note type in types.ts contains no author, courierId, actor or deletedBy fields (AC-3, AC-9, cross check 5)', () => {
    const typesFile = path.join(srcDir, 'types/types.ts');
    const content = fs.readFileSync(typesFile, 'utf-8');
    const noteTypeBlock =
      content.match(/export type Note = \{[\s\S]*?\};/)?.[0] ?? '';

    expect(noteTypeBlock).toBeTruthy();
    // The Note DTO must be author-free on job cards
    expect(noteTypeBlock).not.toMatch(/\bauthor\b/i);
    expect(noteTypeBlock).not.toMatch(/\bcourierId\b/i);
    expect(noteTypeBlock).not.toMatch(/\bactor\b/i);
    expect(noteTypeBlock).not.toMatch(/\bdeletedBy\b/i);
    expect(noteTypeBlock).not.toMatch(/\bdeletedAt\b/i);
  });

  it('no source file introduces per-author upvote totals, scores, or rankings (Value 5, cross check 12)', () => {
    function getSourceFiles(dir: string): string[] {
      const files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__mocks__') {
            files.push(...getSourceFiles(fullPath));
          }
        } else if (
          /\.(ts|tsx)$/.test(entry.name) &&
          !/\.test\.(ts|tsx)$/.test(entry.name)
        ) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const files = getSourceFiles(srcDir);
    const forbiddenPatterns = [
      /\bauthorUpvotes\b/i,
      /\bcourierUpvotes\b/i,
      /\briderUpvotes\b/i,
      /\btotalNoteUpvotes\b/i,
      /\bnoteScore\b/i,
      /\bnoteRating\b/i,
      /\bnoteRank\b/i,
      /\bauthorNotesCount\b/i,
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            const rel = path.relative(srcDir, file);
            violations.push(`src/${rel}:${index + 1}: ${line.trim()}`);
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('notes with phone numbers or personal data are flagged so they cannot save without confirmation (AC-4, AC-9)', () => {
    // 8+ digits with various formats
    expect(looksLikePersonalData('Call 6912345678 for access')).toBe(true);
    expect(looksLikePersonalData('Phone: +30 691 234 5678')).toBe(true);
    expect(looksLikePersonalData('Ring 210-123-4567')).toBe(true);

    // Door codes and floor numbers (short digits) are NOT personal data and can save directly
    expect(looksLikePersonalData('Door code is 1234, 3rd floor')).toBe(false);
  });
});
