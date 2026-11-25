// Row 164: the restaurant changed the notes or the times of a job this rider holds. Plain functions, so each rule is
// tested on its own; the words come from the translations.

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Which kinds of thing the restaurant changed (backend `JobEditedField`).
export type JobEditedField = 'NOTES' | 'TIMES';

// What the backend sends as JOB_EDITED, over the live connection or by push (backend `JobEditedMessage`): ids, the
// restaurant's name and which kinds changed, never the notes themselves.
export type JobEdited = {
  deliveryId: string;
  restaurantName: string;
  changed: JobEditedField[];
  // When the server sent it; the live copy and the push of one edit share it.
  editedAt: string;
};

const FIELDS: JobEditedField[] = ['NOTES', 'TIMES'];

// A JOB_EDITED message read from the live connection (typed values) or a push (all strings, `changed` joined with
// commas). Anything without a delivery id or a known kind is ignored.
export const parseJobEdited = (data: unknown): JobEdited | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const d = data as Record<string, unknown>;
  const text = (value: unknown): string | null =>
    typeof value === 'string' && value !== '' ? value : null;
  const deliveryId = text(d.deliveryId);
  if (!deliveryId) {
    return null;
  }
  const sent: unknown[] = Array.isArray(d.changed)
    ? d.changed
    : typeof d.changed === 'string'
    ? d.changed.split(',')
    : [];
  // In a fixed order, each once, so "notes, times" always reads the same way.
  const changed = FIELDS.filter(field => sent.includes(field));
  if (changed.length === 0) {
    return null;
  }
  return {
    deliveryId,
    restaurantName: text(d.restaurantName) ?? '',
    changed,
    editedAt: text(d.editedAt) ?? '',
  };
};

// "notes", "times" or "notes, times", in the rider's language.
export const changedWords = (changed: JobEditedField[], t: Translate): string =>
  changed
    .map(field =>
      t(
        field === 'NOTES'
          ? 'translations:job_edited_notes'
          : 'translations:job_edited_times',
      ),
    )
    .join(', ');

// The notice's words: "R73 Kitchen: notes, times".
export const jobEditedNoticeText = (update: JobEdited, t: Translate): string =>
  t('translations:job_edited_notice', {
    restaurant: update.restaurantName,
    what: changedWords(update.changed, t),
  });

// The card's one line: "Restaurant changed: notes". Empty when nothing was changed.
export const jobEditedLine = (
  changed: JobEditedField[],
  t: Translate,
): string =>
  changed.length === 0
    ? ''
    : t('translations:job_edited_line', { what: changedWords(changed, t) });
