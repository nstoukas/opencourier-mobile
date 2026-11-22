import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { NoteIcon } from 'phosphor-react-native/src/icons/Note';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ThumbsUpIcon } from 'phosphor-react-native/src/icons/ThumbsUp';
import { FlagIcon } from 'phosphor-react-native/src/icons/Flag';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { JobSheet } from '@app/components/JobSheet/JobSheet';
import { AddressNotesRules } from '@app/components/AddressNotesRules/AddressNotesRules';
import { JobNote, LEAVE_AT_DOOR, NoteAuthor } from '@app/utilities/jobCard';
import { Note } from '@app/types/types';
import { hitSlopFor } from '@app/utilities/touch';
import { color, control, space, typeScale } from '@app/styles/theme';
import { capitals } from '@app/utilities/capitals';

// Spec 0053: what a rider can do with notes about the place of this stop. Left out (as in older
// callers and tests), the riders' notes are plain text and nothing can be added.
export type AddressNoteActions = {
  // Opens the screen to add a note on this stop.
  onAdd: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  // A second tap takes the upvote back.
  onUpvote: (note: Note) => void;
  onFlag: (note: Note) => void;
  // The co-op's addressNoteRetentionDays, for the rules notice.
  retentionDays?: number;
  // Row 82 review: true while this note's upvote or flag is on its way; its buttons wait meanwhile.
  isBusy?: (note: Note) => boolean;
};

type Props = { notes: JobNote[]; addressNotes?: AddressNoteActions };

// The translation key naming each author in the sheet.
const AUTHOR_KEY: Record<NoteAuthor, string> = {
  door: 'translations:notes_from_customer',
  customer: 'translations:notes_from_customer',
  restaurant: 'translations:notes_from_restaurant',
  riders: 'translations:notes_from_riders',
};

const SECTIONS: NoteAuthor[] = ['customer', 'restaurant', 'riders'];

type RowProps = {
  note: Note;
  actions: AddressNoteActions;
  // Closes the sheet before a screen opens over it (a Modal would stay on top of the screen).
  closeThen: (action: () => void) => void;
};

// Spec 0053 (AC-5, AC-7): one rider note in the sheet. Another rider's note can be upvoted (with
// its count of upvotes) and flagged; the rider's own note can be edited or deleted. No author.
const AddressNoteRow = ({ note, actions, closeThen }: RowProps) => {
  const { t } = useTranslation();
  const busy = actions.isBusy?.(note) ?? false;
  const flag = () =>
    Alert.alert(
      t('translations:address_note_flag_title'),
      t('translations:address_note_flag_body'),
      [
        { text: t('translations:cancel'), style: 'cancel' },
        {
          text: t('translations:address_note_flag_confirm'),
          style: 'destructive',
          onPress: () => actions.onFlag(note),
        },
      ],
    );
  return (
    <View style={styles.riderNote} testID={`address-note-${note.id}`}>
      <Text style={styles.note}>{note.note}</Text>
      <View style={styles.noteActions}>
        {note.mine ? (
          <>
            <TouchableOpacity
              hitSlop={hitSlopFor(28, 28, 4)}
              style={styles.noteAction}
              onPress={() => closeThen(() => actions.onEdit(note))}
              accessibilityRole="button"
              accessibilityLabel={t('translations:address_note_edit')}>
              <Icon icon={PencilSimpleIcon} size={18} tone="muted-foreground" />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={hitSlopFor(28, 28, 4)}
              style={styles.noteAction}
              onPress={() => closeThen(() => actions.onDelete(note))}
              accessibilityRole="button"
              accessibilityLabel={t('translations:address_note_delete')}>
              <Icon icon={TrashIcon} size={18} tone="muted-foreground" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              hitSlop={hitSlopFor(28, 28, 4)}
              style={styles.noteAction}
              onPress={() => actions.onUpvote(note)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{
                selected: note.upvotedByMe,
                disabled: busy,
              }}
              accessibilityLabel={t(
                note.upvotedByMe
                  ? 'translations:address_note_upvoted'
                  : 'translations:address_note_upvote',
                { count: note.upvotes },
              )}
              testID={`address-note-upvote-${note.id}`}>
              <Icon
                icon={ThumbsUpIcon}
                size={18}
                weight={note.upvotedByMe ? 'fill' : 'regular'}
                tone={note.upvotedByMe ? 'success' : 'muted-foreground'}
              />
              <Text style={styles.count}>{note.upvotes}</Text>
            </TouchableOpacity>
            {note.flaggedByMe ? (
              <Text style={styles.flagged}>
                {t('translations:address_note_flagged_mark')}
              </Text>
            ) : (
              <TouchableOpacity
                hitSlop={hitSlopFor(28, 28, 4)}
                style={styles.noteAction}
                onPress={flag}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                accessibilityLabel={t('translations:address_note_flag')}
                testID={`address-note-flag-${note.id}`}>
                <Icon icon={FlagIcon} size={18} tone="muted-foreground" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
};

// Spec 0021 (AC-14): every note on one line, never more. The line shows the
// first note cut to one line and "+N" for the rest; a tap opens a sheet with
// all of them under who wrote them. No notes, no line, unless the rider can
// add one (spec 0053): then the line offers to add a note about this place.
export const JobNotesLine = ({ notes, addressNotes }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Spec 0053 (AC-8): the sheet shows the rules instead of the notes after "How notes work".
  const [showRules, setShowRules] = useState(false);
  if (notes.length === 0 && !addressNotes) {
    return null;
  }
  // "Leave at door" is a marker in the data; the words are translated here.
  const textOf = (note: JobNote) =>
    note.author === 'door' && note.text === LEAVE_AT_DOOR
      ? t('translations:leave_at_door')
      : note.text;
  const rest = notes.length - 1;
  const close = () => {
    setOpen(false);
    setShowRules(false);
  };
  const closeThen = (action: () => void) => {
    close();
    action();
  };
  return (
    <>
      <TouchableOpacity
        style={styles.line}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          notes.length > 0
            ? t('translations:notes_open', { count: notes.length })
            : t('translations:address_note_add')
        }
        testID="job-notes-line">
        <Icon icon={NoteIcon} size={20} tone="muted-foreground" />
        <Text
          style={notes.length > 0 ? styles.text : styles.addText}
          numberOfLines={1}>
          {notes.length > 0
            ? textOf(notes[0])
            : t('translations:address_note_add')}
        </Text>
        {rest > 0 ? <Text style={styles.more}>{`+${rest}`}</Text> : null}
        <Icon icon={CaretRightIcon} size={16} tone="muted-foreground" />
      </TouchableOpacity>
      <JobSheet
        visible={open}
        title={
          showRules
            ? t('translations:address_note_rules_title')
            : t('translations:notes_title')
        }
        onClose={close}
        testID="job-notes-sheet">
        {showRules ? (
          <AddressNotesRules retentionDays={addressNotes?.retentionDays} />
        ) : (
          <>
            {SECTIONS.map(section => {
              // Leave at door is the customer's choice, so it sits with theirs.
              const inSection = notes.filter(note =>
                section === 'customer'
                  ? note.author === 'customer' || note.author === 'door'
                  : note.author === section,
              );
              // The riders' section stays, empty, when the rider can add a note to it.
              if (
                inSection.length === 0 &&
                !(section === 'riders' && addressNotes)
              ) {
                return null;
              }
              return (
                <View key={section} style={styles.section}>
                  <Text style={styles.author}>
                    {capitals(t(AUTHOR_KEY[section]))}
                  </Text>
                  {inSection.map((note, index) =>
                    note.addressNote && addressNotes ? (
                      <AddressNoteRow
                        key={note.addressNote.id}
                        note={note.addressNote}
                        actions={addressNotes}
                        closeThen={closeThen}
                      />
                    ) : (
                      <Text key={index} style={styles.note}>
                        {textOf(note)}
                      </Text>
                    ),
                  )}
                  {section === 'riders' && addressNotes ? (
                    <View style={styles.riderLinks}>
                      <TouchableOpacity
                        style={styles.link}
                        onPress={() => closeThen(addressNotes.onAdd)}
                        accessibilityRole="button"
                        testID="address-note-add">
                        <Icon icon={PlusIcon} size={18} tone="primary" />
                        <Text style={styles.linkText}>
                          {t('translations:address_note_add')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.link}
                        onPress={() => setShowRules(true)}
                        accessibilityRole="button"
                        testID="address-note-how">
                        <Icon
                          icon={InfoIcon}
                          size={18}
                          tone="muted-foreground"
                        />
                        <Text style={styles.howText}>
                          {t('translations:address_note_how')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </JobSheet>
    </>
  );
};

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    minHeight: control.xl,
  },
  text: {
    ...typeScale['body-sm'],
    color: color.foreground,
    flexShrink: 1,
  },
  addText: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
    flexShrink: 1,
  },
  more: {
    ...typeScale.caption,
    color: color['muted-foreground'],
  },
  section: {
    paddingVertical: space['2'],
    gap: space['1'],
  },
  author: {
    ...typeScale.overline,
    // In capitals by `capitals()`, which drops Greek accents (row 47).
    textTransform: 'none',
    color: color['muted-foreground'],
  },
  note: {
    ...typeScale.body,
    color: color.foreground,
    flexShrink: 1,
  },
  riderNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    minHeight: control.xl,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    marginLeft: 'auto',
  },
  noteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    minHeight: control.lg,
  },
  count: {
    ...typeScale.caption,
    color: color['muted-foreground'],
  },
  flagged: {
    ...typeScale.caption,
    color: color['muted-foreground'],
  },
  riderLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space['3'],
    paddingTop: space['1'],
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    minHeight: control.xl,
  },
  linkText: {
    ...typeScale['body-sm'],
    color: color.primary,
  },
  howText: {
    ...typeScale['body-sm'],
    color: color['muted-foreground'],
  },
});
