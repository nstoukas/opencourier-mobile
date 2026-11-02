import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@app/components/Icon/Icon';
import { NoteIcon } from 'phosphor-react-native/src/icons/Note';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { JobSheet } from '@app/components/JobSheet/JobSheet';
import { JobNote, LEAVE_AT_DOOR, NoteAuthor } from '@app/utilities/jobCard';
import { color, control, space, typeScale } from '@app/styles/theme';

type Props = { notes: JobNote[] };

// The translation key naming each author in the sheet.
const AUTHOR_KEY: Record<NoteAuthor, string> = {
  door: 'translations:notes_from_customer',
  customer: 'translations:notes_from_customer',
  restaurant: 'translations:notes_from_restaurant',
  riders: 'translations:notes_from_riders',
};

const SECTIONS: NoteAuthor[] = ['customer', 'restaurant', 'riders'];

// Spec 0021 (AC-14): every note on one line, never more. The line shows the
// first note cut to one line and "+N" for the rest; a tap opens a sheet with
// all of them under who wrote them. No notes, no line.
export const JobNotesLine = ({ notes }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (notes.length === 0) {
    return null;
  }
  // "Leave at door" is a marker in the data; the words are translated here.
  const textOf = (note: JobNote) =>
    note.author === 'door' && note.text === LEAVE_AT_DOOR
      ? t('translations:leave_at_door')
      : note.text;
  const rest = notes.length - 1;
  return (
    <>
      <TouchableOpacity
        style={styles.line}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('translations:notes_open', {
          count: notes.length,
        })}
        testID="job-notes-line">
        <Icon icon={NoteIcon} size={20} tone="muted-foreground" />
        <Text style={styles.text} numberOfLines={1}>
          {textOf(notes[0])}
        </Text>
        {rest > 0 ? <Text style={styles.more}>{`+${rest}`}</Text> : null}
        <Icon icon={CaretRightIcon} size={16} tone="muted-foreground" />
      </TouchableOpacity>
      <JobSheet
        visible={open}
        title={t('translations:notes_title')}
        onClose={() => setOpen(false)}
        testID="job-notes-sheet">
        {SECTIONS.map(section => {
          // Leave at door is the customer's choice, so it sits with theirs.
          const inSection = notes.filter(note =>
            section === 'customer'
              ? note.author === 'customer' || note.author === 'door'
              : note.author === section,
          );
          if (inSection.length === 0) {
            return null;
          }
          return (
            <View key={section} style={styles.section}>
              <Text style={styles.author}>{t(AUTHOR_KEY[section])}</Text>
              {inSection.map((note, index) => (
                <Text key={index} style={styles.note}>
                  {textOf(note)}
                </Text>
              ))}
            </View>
          );
        })}
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
    color: color['muted-foreground'],
  },
  note: {
    ...typeScale.body,
    color: color.foreground,
  },
});
