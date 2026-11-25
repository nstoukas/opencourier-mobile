import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { jobEditedLine } from '@app/utilities/jobEdits';
import { useJobEditMarks } from '@app/services/jobEdits/jobEditMarks';
import { color, typeScale } from '@app/styles/theme';

type Props = {
  deliveryId: string;
};

// Row 164: "Restaurant changed: notes, times" on the job card, once the restaurant has edited a job this rider
// holds. One line, in the job screens' style; the notes line just above already shows the new notes.
export const JobEditedLine = ({ deliveryId }: Props) => {
  const { t } = useTranslation();
  const line = jobEditedLine(useJobEditMarks(deliveryId), t);
  if (line === '') {
    return null;
  }
  return (
    <Text style={styles.line} numberOfLines={1} testID="job-edited-line">
      {line}
    </Text>
  );
};

const styles = StyleSheet.create({
  line: {
    ...typeScale.body,
    fontWeight: '600',
    color: color.foreground,
  },
});
