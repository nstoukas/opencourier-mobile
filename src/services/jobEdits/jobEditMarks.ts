import { useSyncExternalStore } from 'react';
import { JobEdited, JobEditedField } from '@app/utilities/jobEdits';

// Row 164: which kinds of thing the restaurant changed on each job this rider holds, so the job card can say so.
// Kept on this phone, in memory only, while the app runs: nothing is sent back and nothing records whether the rider
// looked (binding value 5). A restart forgets the marks; the job itself always shows its current notes.

const marks = new Map<string, JobEditedField[]>();
const listeners = new Set<() => void>();
const NONE: JobEditedField[] = [];

// Adds this edit's kinds to the job's marks (a notes change, then a times change, shows both).
export const markJobEdited = (update: JobEdited): void => {
  const before = marks.get(update.deliveryId) ?? NONE;
  const after = (['NOTES', 'TIMES'] as JobEditedField[]).filter(
    field => before.includes(field) || update.changed.includes(field),
  );
  if (after.length === before.length) {
    return;
  }
  marks.set(update.deliveryId, after);
  listeners.forEach(listener => listener());
};

export const jobEditMarksFor = (deliveryId: string): JobEditedField[] =>
  marks.get(deliveryId) ?? NONE;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// useSyncExternalStore: React's way to read a value kept outside React, and draw again when it changes.
export const useJobEditMarks = (deliveryId: string): JobEditedField[] =>
  useSyncExternalStore(subscribe, () => jobEditMarksFor(deliveryId));

// For tests only: forget every mark.
export const resetJobEditMarksForTests = (): void => {
  marks.clear();
  listeners.forEach(listener => listener());
};
